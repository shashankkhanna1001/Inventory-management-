/**
 * LarkEmployeeSyncService
 *
 * Responsible for keeping the Lark Bitable "Employee Directory" table in sync
 * with the backend user store (users.json).
 *
 * ⚠️  SECURITY: Only non-sensitive fields are synced to Lark —
 *     name, empCode, email, team, department, role.
 *     Passwords and tokens are NEVER sent to Lark.
 */

import { getLarkClient } from '../config/index.js';
import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Lark field names in the Employee Directory table
// ---------------------------------------------------------------------------

const FIELDS = {
  employeeName: 'Employee Name',
  employeeCode: 'Employee Code',
  email: 'Email',
  team: 'Team',
  department: 'Department',
  role: 'Role',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeDirectoryEntry {
  empCode: string;
  name: string;
  email: string;
  team: string;
  department: string;
  role: string;
}

interface LarkRecord {
  record_id?: string;
  fields?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LarkEmployeeSyncService {
  private get tableId(): string {
    return env.LARK_TABLE_EMPLOYEES;
  }

  private get appToken(): string {
    return env.LARK_BITABLE_APP_TOKEN;
  }

  private get isConfigured(): boolean {
    return Boolean(
      this.tableId &&
        this.tableId.length > 0 &&
        this.tableId !== 'tbl_employees_default' &&
        this.appToken,
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Fetch all employees from the Lark Employee Directory table.
   * Returns an empty array if the table is not configured.
   */
  async listFromLark(): Promise<EmployeeDirectoryEntry[]> {
    if (!this.isConfigured) return [];

    try {
      const client = getLarkClient();
      const records: LarkRecord[] = [];
      let pageToken: string | undefined;

      do {
        const resp = await client.bitable.appTableRecord.list({
          path: { app_token: this.appToken, table_id: this.tableId },
          params: {
            page_size: 100,
            ...(pageToken !== undefined && { page_token: pageToken }),
          },
        });

        const data = resp.data as {
          items?: LarkRecord[];
          has_more?: boolean;
          page_token?: string;
        };

        if (data?.items) {
          records.push(...data.items);
        }

        pageToken = data?.has_more && data.page_token ? data.page_token : undefined;
      } while (pageToken);

      return records.map((r) => this.toEntry(r));
    } catch (err) {
      console.error('[LarkEmployeeSync] Failed to list employees from Lark:', err);
      return [];
    }
  }

  /**
   * Upsert a single employee into the Lark Employee Directory table.
   * Finds existing record by Employee Code and updates it; otherwise creates a new row.
   */
  async upsertEmployee(entry: EmployeeDirectoryEntry): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const client = getLarkClient();
      const existingRecordId = await this.findRecordByEmpCode(entry.empCode);

      const fields: Record<string, string> = {
        [FIELDS.employeeName]: entry.name,
        [FIELDS.employeeCode]: entry.empCode,
        [FIELDS.email]: entry.email,
        [FIELDS.team]: entry.team,
        [FIELDS.department]: entry.department,
        [FIELDS.role]: entry.role,
      };

      if (existingRecordId) {
        await client.bitable.appTableRecord.update({
          path: { app_token: this.appToken, table_id: this.tableId, record_id: existingRecordId },
          data: { fields },
        });
        console.log(`[LarkEmployeeSync] Updated employee ${entry.empCode} (${entry.name}) in Lark.`);
      } else {
        await client.bitable.appTableRecord.create({
          path: { app_token: this.appToken, table_id: this.tableId },
          data: { fields },
        });
        console.log(`[LarkEmployeeSync] Added employee ${entry.empCode} (${entry.name}) to Lark.`);
      }
    } catch (err) {
      // Non-fatal — log but don't crash the primary operation
      console.error(`[LarkEmployeeSync] Failed to upsert employee ${entry.empCode}:`, err);
    }
  }

  /**
   * Remove an employee record from the Lark Employee Directory table.
   * Non-fatal if the record is not found.
   */
  async removeEmployee(empCode: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const client = getLarkClient();
      const recordId = await this.findRecordByEmpCode(empCode);
      if (!recordId) {
        console.warn(`[LarkEmployeeSync] No Lark record found for employee ${empCode}.`);
        return;
      }

      await client.bitable.appTableRecord.delete({
        path: { app_token: this.appToken, table_id: this.tableId, record_id: recordId },
      });
      console.log(`[LarkEmployeeSync] Removed employee ${empCode} from Lark.`);
    } catch (err) {
      console.error(`[LarkEmployeeSync] Failed to remove employee ${empCode} from Lark:`, err);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async findRecordByEmpCode(empCode: string): Promise<string | null> {
    try {
      const client = getLarkClient();

      const resp = await client.bitable.appTableRecord.list({
        path: { app_token: this.appToken, table_id: this.tableId },
        params: {
          filter: `CurrentValue.[Employee Code]="${empCode}"`,
          page_size: 1,
        },
      });

      const data = resp.data as { items?: LarkRecord[] };
      const record = data?.items?.[0];
      return record?.record_id ?? null;
    } catch {
      return null;
    }
  }

  private toEntry(record: LarkRecord): EmployeeDirectoryEntry {
    const f = (record.fields ?? {}) as Record<string, unknown>;
    const str = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) {
        const first = val[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') {
          const named = first as { name?: unknown; text?: unknown };
          return (named.name as string) || (named.text as string) || '';
        }
      }
      return val ? String(val) : '';
    };

    return {
      empCode: str(f[FIELDS.employeeCode]),
      name: str(f[FIELDS.employeeName]),
      email: str(f[FIELDS.email]),
      team: str(f[FIELDS.team]),
      department: str(f[FIELDS.department]),
      role: str(f[FIELDS.role]),
    };
  }
}

export const larkEmployeeSyncService = new LarkEmployeeSyncService();
