// apps/app/src/services/NotionService.ts
// Shiftledger Phase 3 — Notion sync for contract tracking
//
// Syncs paid contracts to a Notion data source.
// Data source ID: NOTION_CONTRACTS_DSID (or NOTION_DATABASE_ID).
// Token: NOTION_TOKEN.
//
// Each contract becomes a page in the "Shiftledger Contracts" database.
// The database must have these properties (case-sensitive):
//   - Contract ID  (title)
//   - Tier         (select: Trial / Standard / Enterprise)
//   - Worker       (rich_text)
//   - Customer     (rich_text)
//   - Status       (select: Pending / Active / Paused / Completed / Cancelled)
//   - Revenue USD  (number)
//   - Referral     (rich_text, optional)

import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

export interface NotionContractPage {
  contractId: string;
  tier: string;
  workerProfileName: string;
  customerEmail: string;
  customerOrgName?: string;
  status: string;
  revenueUsd: string;
  referralCode?: string;
  createdAt: string;
}

export class NotionService {
  /**
   * Sync a contract to the Notion "Shiftledger Contracts" data source.
   * Creates or updates a page in the Notion database.
   */
  static async syncContract(contractId: string): Promise<{ ok: boolean; notionPageId?: string }> {
    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) {
      console.log(`[Notion] NOTION_TOKEN not set — skipping sync for contract ${contractId}`);
      return { ok: false };
    }

    const databaseId = process.env.NOTION_CONTRACTS_DSID ?? process.env.NOTION_DATABASE_ID;
    if (!databaseId) {
      console.log(`[Notion] No Notion database ID configured — skipping sync for contract ${contractId}`);
      return { ok: false };
    }

    try {
      // 1. Fetch contract with customer info
      const [contract] = await db
        .select()
        .from(schema.contracts)
        .where(eq(schema.contracts.id, contractId))
        .limit(1);

      if (!contract) {
        console.error(`[Notion] Contract not found: ${contractId}`);
        return { ok: false };
      }

      // 2. Fetch customer
      let customerEmail = "unknown";
      let customerOrgName: string | undefined;
      if (contract.customerId) {
        const [customer] = await db
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.id, contract.customerId))
          .limit(1);
        if (customer) {
          customerEmail = customer.email;
          customerOrgName = customer.orgName ?? undefined;
        }
      }

      // 3. Fetch worker profile name
      let workerProfileName: string = contract.workerProfileId ?? "unknown";
      if (contract.workerProfileId) {
        const [wp] = await db
          .select()
          .from(schema.workerProfiles)
          .where(eq(schema.workerProfiles.id, contract.workerProfileId))
          .limit(1);
        if (wp) {
          workerProfileName = wp.displayName;
        }
      }

      // 4. Build Notion page properties
      const pageData = NotionService.buildPageProperties({
        contractId: contract.id,
        tier: contract.tier ?? "trial",
        workerProfileName,
        customerEmail,
        customerOrgName,
        status: contract.status ?? "pending",
        revenueUsd: (contract.budgetCapUsd ?? contract.unitPriceUsd) ?? "0.00",
        referralCode: contract.referralCode ?? undefined,
        createdAt: contract.createdAt?.toISOString() ?? new Date().toISOString(),
      });

      // 5. Create or update Notion page
      // Check if a page for this contract already exists (search by contract ID in title)
      const existingPageId = await NotionService.findExistingPage(notionToken, databaseId, contractId);

      if (existingPageId) {
        // Update existing page
        const response = await fetch(`https://api.notion.com/v1/pages/${existingPageId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${notionToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({ properties: pageData.properties }),
        });

        if (response.ok) {
          console.log(`[Notion] Updated existing page for contract ${contractId}`);
          return { ok: true, notionPageId: existingPageId };
        }
        console.error(`[Notion] Failed to update page: HTTP ${response.status}`);
        return { ok: false };
      }

      // Create new page
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          ...pageData,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { id: string };
        console.log(`[Notion] Created page for contract ${contractId} — Page ID: ${data.id}`);
        return { ok: true, notionPageId: data.id };
      }

      const errorData = await response.text();
      console.error(`[Notion] Failed to create page: HTTP ${response.status} — ${errorData.slice(0, 300)}`);
      return { ok: false };
    } catch (err) {
      console.error(`[Notion] Error syncing contract ${contractId}: ${(err as Error).message}`);
      return { ok: false };
    }
  }

  /**
   * Build Notion page properties for the Shiftledger Contracts database.
   */
  private static buildPageProperties(data: NotionContractPage) {
    const properties: Record<string, unknown> = {
      "Contract ID": {
        title: [{ text: { content: data.contractId } }],
      },
      Tier: {
        select: { name: data.tier.charAt(0).toUpperCase() + data.tier.slice(1) },
      },
      Worker: {
        rich_text: [{ text: { content: data.workerProfileName } }],
      },
      Customer: {
        rich_text: [{ text: { content: data.customerEmail } }],
      },
      Status: {
        select: { name: data.status.charAt(0).toUpperCase() + data.status.slice(1) },
      },
      "Revenue USD": {
        number: parseFloat(data.revenueUsd) || 0,
      },
    };

    if (data.referralCode) {
      properties["Referral"] = {
        rich_text: [{ text: { content: data.referralCode } }],
      };
    }

    return {
      properties,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `Contract created ${new Date(data.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
                },
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Search the Notion database for an existing page by contract ID.
   * Returns the page ID if found, null otherwise.
   */
  private static async findExistingPage(
    token: string,
    databaseId: string,
    contractId: string,
  ): Promise<string | null> {
    try {
      const response = await fetch("https://api.notion.com/v1/databases/" + databaseId + "/query", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          filter: {
            property: "Contract ID",
            title: {
              equals: contractId,
            },
          },
          page_size: 1,
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { results: Array<{ id: string }> };
      return data.results?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }
}
