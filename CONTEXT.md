# Cashworker Budget Context

Cashworker is a private home budget application where each person manages their own imported bank data. The context exists to keep budget ownership and bank-statement concepts precise as the product grows.

## Language

**User**:
A person who owns private budget data in Cashworker.
_Avoid_: Account, customer

**Bank Account**:
A financial account imported from a bank statement and owned by a **User**.
_Avoid_: User account, login account

**Account Product**:
The bank-provided product name used as the human-readable name for a **Bank Account**.
_Avoid_: Account identifier, IBAN

**IBAN**:
The bank-provided international account number used to identify a **Bank Account**.
_Avoid_: Account name, display name

**Transaction**:
A single bank-recorded account entry imported from a bank statement, including zero-amount technical entries.
_Avoid_: Payment, purchase

**Operation Identifier**:
The bank-provided identifier for a **Transaction** on a statement.
_Avoid_: Reference number, transaction hash

**Booked Date**:
The date when the bank posts a **Transaction** to the account.
_Avoid_: Operation date, transaction date

**Value Date**:
The bank-effective date assigned to a **Transaction**.
_Avoid_: Settlement date

**User Boundary**:
The rule that budget data owned by one **User** must not be visible to or modified by another **User**.
_Avoid_: Tenant, workspace, organization

**Budget Data**:
Financial records and settings owned by a **User** inside Cashworker.
_Avoid_: App data, user content

## Relationships

- A **User** owns their own **Budget Data**.
- A **User Boundary** applies to all **Budget Data**.
- A **User** owns zero or more **Bank Accounts**.
- A **Bank Account** has one **IBAN**.
- A **Bank Account** uses its **Account Product** as its human-readable name.
- A **Bank Account** has zero or more **Transactions**.
- A **Transaction** has one **Operation Identifier** from the bank statement.
- A **Transaction** has one **Booked Date** and one **Value Date**.

## Example dialogue

> **Dev:** "Can two people share the same imported transactions?"
> **Domain expert:** "No. Each **User** has their own **Budget Data**, and the **User Boundary** prevents sharing in the first version."

> **Dev:** "Should we show the IBAN as the main account label?"
> **Domain expert:** "No. Use the **Account Product** as the account name; the **IBAN** is useful but not the primary label."

> **Dev:** "How do we know whether an imported row is the same transaction?"
> **Domain expert:** "Use the **Operation Identifier** from the bank statement for the **Transaction**."

> **Dev:** "Which date should the budget timeline use?"
> **Domain expert:** "Use the **Booked Date** by default, but keep the **Value Date** from the statement."

## Flagged ambiguities

- "account" must not be used for **User** because the product also has bank accounts.
- "account identifier" must not mean the display name; **IBAN** identifies a **Bank Account**, while **Account Product** names it for humans.
