import "server-only";
import { query, queryOne } from "./mssql";
import type { Account } from "@/types";

function mapRow(row: {
  account_id: number;
  name: string;
  avatar: string;
  shopify_domain: string;
  gmail?: string | null;
}): Account {
  return {
    accountId: row.account_id,
    name: row.name,
    avatar: row.avatar,
    shopifyDomain: row.shopify_domain,
    gmail: row.gmail ?? undefined,
  };
}

export async function listAccounts(): Promise<Account[]> {
  const rows = await query<{
    account_id: number;
    name: string;
    avatar: string;
    shopify_domain: string;
    gmail?: string | null;
  }>(`
    SELECT account_id, name, avatar, shopify_domain, gmail
    FROM dbo.tbl_accounts
    ORDER BY account_id
  `);
  return rows.map(mapRow);
}

export async function getAccountById(accountId: number): Promise<Account | null> {
  const row = await queryOne<{
    account_id: number;
    name: string;
    avatar: string;
    shopify_domain: string;
    gmail?: string | null;
  }>(`
    SELECT account_id, name, avatar, shopify_domain, gmail
    FROM dbo.tbl_accounts
    WHERE account_id = @AccountId
  `, { AccountId: accountId });
  return row ? mapRow(row) : null;
}
