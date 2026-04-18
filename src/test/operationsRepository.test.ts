import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperationalCase,
  fetchOperationalCases,
  fetchOperationalCasesSnapshot,
  setOperationalCaseStatus,
} from "@/lib/operationsRepository";
import { supabase } from "@/lib/supabase";

const { backendRows, createCaseRpcMock, updateCaseMock, auditInsertMock } = vi.hoisted(() => ({
  backendRows: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      reference_id: "PAY-BACKEND-1",
      area: "payments",
      title: "Backend payment case",
      summary: "Authoritative backend case.",
      status: "new",
      priority: "urgent",
      owner: "Payments owner",
      requester_email: "client@example.com",
      related_reference: "BK-1",
      evidence: ["Stripe checkout event"],
      timeline: [
        {
          at: "2026-04-17T09:00:00.000Z",
          actor: "Λειτουργία",
          action: "Άνοιγμα υπόθεσης",
          note: "Authoritative backend case.",
        },
      ],
      sla_due_at: "2026-04-17T13:00:00.000Z",
      created_at: "2026-04-17T09:00:00.000Z",
      updated_at: "2026-04-17T09:00:00.000Z",
    },
  ],
  createCaseRpcMock: vi.fn(),
  updateCaseMock: vi.fn(),
  auditInsertMock: vi.fn(),
}));

const thenable = <T,>(response: T) => ({
  then: (resolve: (value: T) => unknown, reject: (reason?: unknown) => unknown) => Promise.resolve(response).then(resolve, reject),
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: createCaseRpcMock.mockImplementation((_functionName: string, payload: Record<string, unknown>) =>
      Promise.resolve({
        data: {
          id: payload.p_case_id,
          reference_id: payload.p_reference_id,
          area: payload.p_area,
          title: payload.p_title,
          summary: payload.p_summary,
          status: payload.p_status,
          priority: payload.p_priority,
          owner: payload.p_owner,
          requester_email: payload.p_requester_email,
          related_reference: payload.p_related_reference,
          evidence: payload.p_evidence,
          timeline: payload.p_timeline,
          sla_due_at: payload.p_sla_due_at,
          created_at: "2026-04-17T10:00:00.000Z",
          updated_at: "2026-04-17T10:00:00.000Z",
        },
        error: null,
      }),
    ),
    from: vi.fn((tableName: string) => {
      if (tableName === "operational_audit_events") {
        return {
          insert: auditInsertMock.mockResolvedValue({ error: null }),
        };
      }

      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            ...thenable({ data: backendRows, error: null }),
            eq: vi.fn((_field: string, value: string) =>
              thenable({
                data: backendRows.filter((row) => row.area === value),
                error: null,
              }),
            ),
          })),
          eq: vi.fn((_field: string, value: string) => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: backendRows.find((row) => row.id === value) || null,
                error: null,
              }),
            ),
          })),
        })),
        update: updateCaseMock.mockImplementation((payload) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: payload,
                  error: null,
                }),
              ),
            })),
          })),
        })),
      };
    }),
  },
}));

describe("operations repository", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("fetches operational cases from the backend before using local fallback data", async () => {
    localStorage.setItem(
      "dikigoros.operationalCases.cache.v2",
      JSON.stringify([
        {
          id: "local-case",
          referenceId: "LOCAL-ONLY",
          area: "support",
          title: "Local only",
          summary: "Should not win over backend truth.",
          status: "new",
          priority: "normal",
          owner: "Local",
          evidence: [],
          createdAt: "2026-04-17T08:00:00.000Z",
          updatedAt: "2026-04-17T08:00:00.000Z",
          slaDueAt: "2026-04-18T08:00:00.000Z",
          timeline: [],
        },
      ]),
    );

    const cases = await fetchOperationalCases();

    expect(supabase.from).toHaveBeenCalledWith("operational_cases");
    expect(cases).toHaveLength(1);
    expect(cases[0].referenceId).toBe("PAY-BACKEND-1");
  });

  it("reports whether operational queue metrics are backed by backend truth", async () => {
    const snapshot = await fetchOperationalCasesSnapshot();

    expect(snapshot.source).toBe("backend");
    expect(snapshot.cases[0].referenceId).toBe("PAY-BACKEND-1");
  });

  it("persists status updates, assignments, and timeline entries remotely", async () => {
    const updated = await setOperationalCaseStatus(
      "11111111-1111-1111-1111-111111111111",
      "in_review",
      "Ξεκίνησε backend έλεγχος.",
    );

    expect(updateCaseMock).toHaveBeenCalledTimes(1);
    const payload = updateCaseMock.mock.calls[0][0];
    expect(payload.status).toBe("in_review");
    expect(payload.timeline[0].action).toBe("Η κατάσταση άλλαξε σε Σε έλεγχο");
    expect(payload.timeline[0].note).toBe("Ξεκίνησε backend έλεγχος.");
    expect(updated?.status).toBe("in_review");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operational_case_id: "11111111-1111-1111-1111-111111111111",
        event_type: "Η κατάσταση άλλαξε σε Σε έλεγχο",
      }),
    );
  });

  it("creates new operational cases through the backend RPC", async () => {
    const created = await createOperationalCase({
      area: "bookingDisputes",
      title: "Σύγκρουση ώρας",
      summary: "Η επιλεγμένη ώρα δεν είναι πλέον διαθέσιμη.",
      priority: "urgent",
      requesterEmail: "client@example.com",
      relatedReference: "BK-20260417-1",
      evidence: ["Κλειδί ώρας", "Κωδικός κράτησης"],
    });

    expect(createCaseRpcMock).toHaveBeenCalledTimes(1);
    expect(createCaseRpcMock).toHaveBeenCalledWith(
      "create_operational_case",
      expect.objectContaining({
        p_area: "bookingDisputes",
        p_status: "new",
        p_requester_email: "client@example.com",
        p_related_reference: "BK-20260417-1",
      }),
    );
    const payload = createCaseRpcMock.mock.calls[0][1];
    expect(payload.p_timeline[0].action).toBe("Άνοιγμα υπόθεσης");
    expect(created.referenceId).toMatch(/^DSP-\d{8}-[A-Z0-9]{1,5}$/);
  });
});
