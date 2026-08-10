import "server-only";
import { queryOne } from "./postgres";
import type { Account } from "@/types";

type CompanyRow = {
  name: string;
  avatar: string;
  gmail: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
};

const COMPANY_COLUMNS = "name, avatar, gmail, phone, address, website";

function mapRow(row: CompanyRow): Account {
  return {
    name: row.name,
    avatar: row.avatar,
    gmail: row.gmail ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    website: row.website ?? undefined,
  };
}

/**
 * Look up a company by id — used to show a user (manager or member) the
 * company they belong to. Every admin/superadmin owns exactly one company
 * (auto-provisioned in SQL, see fn_ensure_company_for_manager); members
 * inherit their referring manager's company_id at registration.
 */
export async function getCompanyById(companyId: number): Promise<Account | null> {
  const row = await queryOne<CompanyRow>(
    `SELECT ${COMPANY_COLUMNS} FROM tbl_companies WHERE id = $1`,
    [companyId],
  );
  return row ? mapRow(row) : null;
}

/** The company owned by this manager (admin/superadmin), if any. */
export async function getCompanyByOwner(ownerId: string): Promise<Account | null> {
  const row = await queryOne<CompanyRow>(
    `SELECT ${COMPANY_COLUMNS} FROM tbl_companies WHERE owner_id = $1`,
    [ownerId],
  );
  return row ? mapRow(row) : null;
}

/**
 * Edit the company profile — restricted to its owner. Returns null if this
 * user doesn't own a company (shouldn't happen for an active manager, since
 * one is auto-provisioned the moment they become admin/superadmin).
 */
export async function updateCompanyByOwner(
  ownerId: string,
  input: {
    name: string;
    avatar: string;
    gmail: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
  },
): Promise<Account | null> {
  const row = await queryOne<CompanyRow>(
    `
    UPDATE tbl_companies
    SET name = $2, avatar = $3, gmail = $4, phone = $5, address = $6, website = $7
    WHERE owner_id = $1
    RETURNING ${COMPANY_COLUMNS}
    `,
    [ownerId, input.name.trim(), input.avatar, input.gmail, input.phone, input.address, input.website],
  );
  return row ? mapRow(row) : null;
}
