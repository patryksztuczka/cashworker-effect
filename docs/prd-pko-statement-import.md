# PRD: PKO Statement Import, Accounts, Transactions, and Import UI

## Problem Statement

The user needs the first usable budgeting workflow after authentication: importing real PKO BP PDF bank statements into Cashworker, creating the relevant bank account automatically, storing every statement entry as a transaction, preventing duplicates, and viewing the results in the web app.

Authentication is intentionally skipped for this stage. The application should use one hardcoded user ID wherever ownership is required, without adding a users table, email verification, sessions, or auth-shaped scaffolding.

## Solution

Build a complete statement import experience for the provided PKO BP PDF statement format. A user uploads a supported statement, the backend parses the deterministic PDF text, validates the extracted account and transaction data, creates or reuses the bank account for the hardcoded user ID, imports all statement entries atomically, prevents duplicate statements and duplicate transactions, and returns a clear import result.

The frontend should be a full usable application workflow, not backend-only. It should include statement upload, import result details, bank account list, transaction list, import history, loading states, empty states, validation errors, duplicate import feedback, and enough navigation to move between these views naturally.

## User Stories

1. As a budget user, I want to upload a PKO BP PDF statement, so that I can import my bank activity without manual entry.
2. As a budget user, I want the app to detect the bank statement format, so that unsupported files are rejected clearly.
3. As a budget user, I want the app to extract my bank account from the statement, so that I do not need to create the account manually.
4. As a budget user, I want the app to reuse an existing bank account when the same IBAN appears again, so that repeated imports build one account history.
5. As a budget user, I want the app to use the account product as the main account name, so that accounts are shown in a human-readable way.
6. As a budget user, I want the app to keep the full IBAN as account detail, so that I can verify which bank account was imported.
7. As a budget user, I want duplicate account names to be disambiguated only when needed, so that the UI stays readable without hiding identity.
8. As a budget user, I want the app to import every statement entry, including zero-amount technical entries, so that imported data matches the source statement.
9. As a budget user, I want each imported transaction to keep its bank operation identifier, so that duplicates can be detected reliably.
10. As a budget user, I want each transaction amount to be accurate to grosze, so that totals do not drift because of decimal rounding.
11. As a budget user, I want each transaction to keep the running balance from the statement, so that I can audit the import.
12. As a budget user, I want each transaction to keep both the booked date and value date, so that bank timing remains visible.
13. As a budget user, I want transaction lists to default to booked date order, so that the list matches the statement flow.
14. As a budget user, I want card purchases to show useful location text, so that I can understand where money was spent.
15. As a budget user, I want transfers to keep their full statement description, so that no sender or payment title details are lost.
16. As a budget user, I want the parser to reject incomplete extraction, so that bad imports do not silently pollute my data.
17. As a budget user, I want imports to be atomic, so that a failed statement does not create partial accounts or transactions.
18. As a budget user, I want duplicate statements to be reported clearly, so that I understand why no new transactions were added.
19. As a budget user, I want duplicate transaction protection, so that overlapping or repeated imports cannot create duplicated rows.
20. As a budget user, I want an import result summary, so that I know which account was affected and how many transactions were imported.
21. As a budget user, I want the import result to show the statement period and statement number, so that I can confirm the imported file.
22. As a budget user, I want the import result to distinguish created accounts from reused accounts, so that I understand what changed.
23. As a budget user, I want the import history to show successful and failed imports, so that I can review past attempts.
24. As a budget user, I want failed imports to show actionable messages, so that I know whether the file is unsupported, duplicate, or malformed.
25. As a budget user, I want a list of bank accounts, so that I can see which accounts Cashworker knows about.
26. As a budget user, I want an account detail view, so that I can inspect one account’s transactions.
27. As a budget user, I want the account detail view to show account product, currency, and IBAN detail, so that the account is identifiable.
28. As a budget user, I want a transaction table with dates, type, description, amount, and balance, so that I can review imported activity.
29. As a budget user, I want income and spending amounts to be visually distinct, so that transaction direction is scannable.
30. As a budget user, I want empty states before importing, so that the app explains what is available without fake sample data.
31. As a budget user, I want loading states during import and data fetching, so that the UI does not appear frozen.
32. As a budget user, I want import errors to preserve the file-selection workflow, so that I can retry without navigating away.
33. As a budget user, I want all imported budget data scoped to the hardcoded user ID, so that future authentication can replace only the current-user source.
34. As a developer, I want a deterministic parser module, so that statement extraction can be tested independently from persistence and UI.
35. As a developer, I want an import orchestration module, so that account creation, duplicate detection, transaction insertion, and rollback rules are handled in one place.
36. As a developer, I want parser fixtures based on the provided PDFs, so that regressions are caught when extraction logic changes.
37. As a developer, I want storage constraints for account and transaction identity, so that duplicate protection is enforced below application code.
38. As a developer, I want API responses shaped around user-facing outcomes, so that the frontend can show clear success, duplicate, and failure states.

## Implementation Decisions

- Skip authentication for this stage.
- Use one hardcoded user ID wherever budget ownership is needed.
- Do not create a users table for this stage.
- Add a user boundary by storing the hardcoded user ID on owned budget records.
- Treat the supported statement format as PKO BP PDF statements with deterministic text extraction.
- Reject unsupported or malformed PDFs rather than attempting OCR or AI extraction.
- Use normalized IBAN as the stable bank account identity.
- Use account product as the primary human-readable account name.
- Store bank account fields: ID, user ID, normalized IBAN, account product, currency, bank name, created timestamp, and updated timestamp.
- Enforce account uniqueness by user ID and normalized IBAN.
- If multiple accounts have the same account product, keep the product as the stored name and disambiguate display with a short IBAN suffix only when needed.
- Store every parsed statement row as a transaction, including zero-amount technical rows such as account opening.
- Use the bank operation identifier as the primary transaction identity.
- Enforce transaction uniqueness by bank account and operation identifier.
- Store money as integer minor units in grosze.
- Store running balance after each transaction as integer minor units.
- Require running balance for each PKO transaction row.
- Store both booked date and value date.
- Use booked date as the default timeline date for budget views.
- Store the full normalized description for every transaction.
- Extract counterparty only when the parser can do so confidently; do not force all descriptions into a single counterparty model yet.
- Implement duplicate prevention at both statement/import level and transaction level.
- Store statement/import identity using statement metadata and/or file hash so repeated files can produce a clear duplicate result.
- Make import atomic: if parsing or validation fails, no account or transaction data from that file is committed.
- Fail the whole import if required statement data or any required transaction field is missing.
- Build a deep parser module that takes a PDF input and returns a normalized statement result or a validation failure.
- Build a deep import orchestration module that coordinates parsing, account creation/reuse, duplicate detection, transaction insertion, and result reporting.
- Build persistence around bank accounts, statement imports, and transactions.
- Build API endpoints for statement upload, account listing, account detail, transaction listing, import result retrieval, and import history.
- Build a complete frontend workflow in this stage, including upload, result, accounts, account detail, transactions, import history, and error states.
- Keep categorization rules out of this stage except for leaving the model open for later assignment.

## Testing Decisions

- Tests should assert externally visible behavior and durable contracts, not internal implementation details.
- Parser tests should use the provided PKO statement PDFs as fixtures and verify extracted account metadata, statement metadata, and representative transactions.
- Parser tests should verify that zero-amount technical entries are preserved.
- Parser tests should verify amount parsing into integer grosze, including negative card transactions and positive incoming transfers.
- Parser tests should verify booked date and value date extraction.
- Parser tests should verify deterministic rejection when required fields are missing or the format is unsupported.
- Import orchestration tests should verify atomic success and failure behavior.
- Import orchestration tests should verify account creation on first import and account reuse on later imports for the same IBAN.
- Import orchestration tests should verify duplicate statement reporting.
- Import orchestration tests should verify transaction duplicate protection by operation identifier.
- Database-level tests should verify uniqueness constraints for bank accounts and transactions.
- API tests should follow the existing backend test style: request the app through HTTP-like handlers and assert status codes and JSON responses.
- Frontend tests should verify the user workflow around upload, success summary, duplicate feedback, accounts list, transaction list, import history, loading states, empty states, and error messages.
- End-to-end tests should cover a successful import from a fixture PDF and the visible data that appears afterward.

## Out of Scope

- Signup, login, sessions, email verification, password reset, and any authentication UI.
- A persisted users table.
- Manual bank account creation.
- Manual bank account renaming.
- Editing imported transactions.
- Deleting imports or transactions.
- Transaction categorization rules.
- Machine-learning categorization or suggestions.
- OCR-based PDF extraction.
- AI-based statement extraction.
- Support for banks other than the current PKO BP statement format.
- Shared accounts, households, teams, or collaboration.
- Permanent storage of original uploaded PDFs unless needed for duplicate detection by hash.
- Full budgeting workflows beyond imported account and transaction viewing.

## Further Notes

- The provided statements expose `Nr IBAN`, `Nr rachunku/karty`, `Rodzaj rachunku`, `Waluta rachunku`, statement period, statement number, transaction rows, operation identifiers, operation types, amounts, running balances, value dates, and descriptions as extractable text.
- The account product in the provided files is `PKO KONTO ZA ZERO`; this should be the main visible account label.
- The normalized IBAN from the provided files is `PL50102040270000110221038296`; it should identify the bank account but should not be the primary account label.
- The current codebase is still near scaffold state, so this work will replace placeholder budget examples with the first real domain workflow.
