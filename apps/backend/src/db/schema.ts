import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const bankAccounts = sqliteTable(
  "bank_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    iban: text("iban").notNull(),
    accountProduct: text("account_product").notNull(),
    currency: text("currency").notNull(),
    bankName: text("bank_name").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("bank_accounts_user_iban_idx").on(table.userId, table.iban)],
);

export const statementImports = sqliteTable(
  "statement_imports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    bankAccountId: text("bank_account_id").notNull(),
    fileHash: text("file_hash").notNull(),
    statementNumber: text("statement_number").notNull(),
    issuedAt: text("issued_at").notNull(),
    periodFrom: text("period_from").notNull(),
    periodTo: text("period_to").notNull(),
    status: text("status", { enum: ["imported", "duplicate", "failed"] }).notNull(),
    importedTransactionCount: integer("imported_transaction_count").notNull(),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("statement_imports_user_file_hash_idx").on(table.userId, table.fileHash),
    uniqueIndex("statement_imports_account_statement_idx").on(
      table.bankAccountId,
      table.statementNumber,
      table.issuedAt,
    ),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    bankAccountId: text("bank_account_id").notNull(),
    statementImportId: text("statement_import_id").notNull(),
    operationId: text("operation_id").notNull(),
    bookedAt: text("booked_at").notNull(),
    valuedAt: text("valued_at").notNull(),
    operationType: text("operation_type").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    balanceAfterMinor: integer("balance_after_minor").notNull(),
    description: text("description").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("transactions_account_operation_idx").on(table.bankAccountId, table.operationId),
  ],
);
