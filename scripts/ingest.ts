import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { prepareInsertNode, prepareInsertEdge, initSchema } from '../lib/db';
import db from '../lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DATA_DIR = path.join(process.cwd(), 'sap-o2c-data');

async function processJsonl(dirName: string, processLine: (obj: any) => any[]) {
  const dirPath = path.join(DATA_DIR, dirName);
  if (!fs.existsSync(dirPath)) return;
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
  for (const file of files) {
    console.log(`Processing ${dirName}/${file}...`);
    const fileStream = fs.createReadStream(path.join(dirPath, file));
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    let dbBatch: any[] = [];
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      const statements = processLine(JSON.parse(line));
      if (statements && statements.length > 0) {
          dbBatch.push(...statements);
      }
      
      if (dbBatch.length >= 500) { 
        await executeBatch(dbBatch);
        dbBatch = [];
      }
    }
    if (dbBatch.length > 0) {
      await executeBatch(dbBatch);
    }
  }
}

async function executeBatch(statements: any[]) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const stmt of statements) {
      await client.query(stmt.sql, stmt.args);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Starting ingestion...');
  
  await initSchema();

  // 1. Business Partners (Customers)
  await processJsonl('business_partners', (obj) => {
    return [prepareInsertNode(obj.businessPartner, 'Customer', {
      name: obj.businessPartnerFullName || obj.businessPartnerName || obj.organizationBpName1,
      category: obj.businessPartnerCategory,
      industry: obj.industry,
    })];
  });

  // 2. Products
  await processJsonl('products', (obj) => {
    return [prepareInsertNode(obj.product, 'Product', {
      type: obj.productType,
      group: obj.productGroup,
      baseUnit: obj.baseUnit,
    })];
  });
  
  // Product Descriptions
  await processJsonl('product_descriptions', (obj) => {
    if (obj.language === 'EN') { 
      return [{
          sql: `UPDATE nodes SET properties = properties || jsonb_build_object('name', $1::text) WHERE id = $2`,
          args: [obj.productDescription, obj.product]
      }];
    }
    return [];
  });

  // 3. Sales Order Headers
  await processJsonl('sales_order_headers', (obj) => {
    const stmts = [prepareInsertNode(obj.salesOrder, 'SalesOrder', {
      date: obj.creationDate,
      totalNetAmount: obj.totalNetAmount,
      currency: obj.transactionCurrency,
    })];
    
    if (obj.soldToParty) {
      stmts.push(prepareInsertEdge(obj.soldToParty, obj.salesOrder, 'PLACES'));
    }
    return stmts;
  });

  // Sales Order Items
  await processJsonl('sales_order_items', (obj) => {
    if (obj.material && obj.salesOrder) {
      return [prepareInsertEdge(obj.salesOrder, obj.material, 'CONTAINS', {
        itemPosition: obj.salesOrderItem,
        quantity: obj.requestedQuantity,
        netAmount: obj.netAmount
      })];
    }
    return [];
  });

  // 4. Outbound Delivery Headers
  await processJsonl('outbound_delivery_headers', (obj) => {
    return [prepareInsertNode(obj.deliveryDocument, 'Delivery', {
      creationDate: obj.creationDate,
      shippingPoint: obj.shippingPoint,
      status: obj.overallGoodsMovementStatus
    })];
  });

  // Outbound Delivery Items
  await processJsonl('outbound_delivery_items', (obj) => {
    if (obj.referenceSdDocument && obj.deliveryDocument) {
      return [prepareInsertEdge(obj.deliveryDocument, obj.referenceSdDocument, 'FULFILLS', {
        deliveryItem: obj.deliveryDocumentItem,
        quantity: obj.actualDeliveryQuantity
      })];
    }
    return [];
  });

  // 5. Billing Document Headers
  await processJsonl('billing_document_headers', (obj) => {
    const stmts = [prepareInsertNode(obj.billingDocument, 'Billing', {
      date: obj.billingDocumentDate,
      type: obj.billingDocumentType,
      amount: obj.totalNetAmount,
      currency: obj.transactionCurrency
    })];
    if (obj.soldToParty) {
      stmts.push(prepareInsertEdge(obj.billingDocument, obj.soldToParty, 'BILLED_TO')); 
    }
    return stmts;
  });

  // Billing Document Items
  await processJsonl('billing_document_items', (obj) => {
    if (obj.referenceSdDocument && obj.billingDocument) {
      return [prepareInsertEdge(obj.billingDocument, obj.referenceSdDocument, 'BILLS_FOR', {
        itemPosition: obj.billingDocumentItem,
        amount: obj.netAmount,
        quantity: obj.billingQuantity
      })];
    }
    return [];
  });

  // 6. Journal Entry Items (Accounting)
  await processJsonl('journal_entry_items_accounts_receivable', (obj) => {
    const id = obj.accountingDocument;
    const stmts = [prepareInsertNode(id, 'JournalEntry', {
      amount: obj.amountInCompanyCodeCurrency,
      date: obj.documentDate,
      currency: obj.companyCodeCurrency,
      type: obj.financialAccountType
    })];
    if (obj.referenceDocument) {
      stmts.push(prepareInsertEdge(id, obj.referenceDocument, 'RECORDS'));
    }
    if (obj.customer) {
      stmts.push(prepareInsertEdge(obj.customer, id, 'OWES'));
    }
    return stmts;
  });

  // 7. Payments
  await processJsonl('payments_accounts_receivable', (obj) => {
    const id = obj.accountingDocument;
    const stmts = [prepareInsertNode(id, 'JournalEntry', {
      amount: obj.amountInCompanyCodeCurrency,
      date: obj.documentDate,
      currency: obj.companyCodeCurrency
    })];
    if (obj.clearingAccountingDocument) {
      stmts.push(prepareInsertEdge(id, obj.clearingAccountingDocument, 'CLEARS'));
    }
    return stmts;
  });

  console.log('Ingestion complete!');
  process.exit(0);
}

main().catch(console.error);
