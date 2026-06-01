CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`iban` text NOT NULL,
	`account_product` text NOT NULL,
	`currency` text NOT NULL,
	`bank_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_accounts_user_iban_idx` ON `bank_accounts` (`user_id`,`iban`);--> statement-breakpoint
CREATE TABLE `statement_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank_account_id` text NOT NULL,
	`file_hash` text NOT NULL,
	`statement_number` text NOT NULL,
	`issued_at` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`status` text NOT NULL,
	`imported_transaction_count` integer NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statement_imports_user_file_hash_idx` ON `statement_imports` (`user_id`,`file_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `statement_imports_account_statement_idx` ON `statement_imports` (`bank_account_id`,`statement_number`,`issued_at`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank_account_id` text NOT NULL,
	`statement_import_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`booked_at` text NOT NULL,
	`valued_at` text NOT NULL,
	`operation_type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`balance_after_minor` integer NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_account_operation_idx` ON `transactions` (`bank_account_id`,`operation_id`);