// apps/app/public/js/dashboard.js — Shiftledger Dashboard client-side JS
// Phase 2 UX surfaces — form handling, token paste, async updates

document.addEventListener("DOMContentLoaded", () => {
  // --- Integration token paste ---
  document.querySelectorAll("[data-integration-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tokenInput = form.querySelector("[name='apiToken']");
      const providerKind = form.dataset.integrationForm;
      const submitBtn = form.querySelector("button[type='submit']");
      const errorEl = form.querySelector("[data-error]");
      const successEl = form.querySelector("[data-success]");

      if (!tokenInput?.value.trim()) return;

      // Reset messages
      if (errorEl) errorEl.classList.add("hidden");
      if (successEl) successEl.classList.add("hidden");

      // Show loading
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Validating…';
      }

      try {
        const res = await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: providerKind, apiToken: tokenInput.value }),
        });

        const data = await res.json();

        if (res.ok) {
          if (successEl) {
            successEl.classList.remove("hidden");
            successEl.textContent = `✓ Connected — ${providerKind} integration is healthy`;
          }
          if (errorEl) errorEl.classList.add("hidden");
          tokenInput.value = "";
          // Reload page after short delay to show updated state
          setTimeout(() => window.location.reload(), 1500);
        } else {
          if (errorEl) {
            errorEl.classList.remove("hidden");
            errorEl.textContent = data.error?.message || "Connection failed";
          }
        }
      } catch (err) {
        if (errorEl) {
          errorEl.classList.remove("hidden");
          errorEl.textContent = "Network error — please try again";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  });

  // --- Integration heartbeat ---
  document.querySelectorAll("[data-heartbeat-btn]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const integrationId = btn.dataset.heartbeatBtn;
      const statusEl = document.querySelector(`[data-integration-status="${integrationId}"]`);

      const originalText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        const res = await fetch(`/api/integrations/${integrationId}/heartbeat`, { method: "POST" });
        const data = await res.json();

        if (statusEl) {
          statusEl.innerHTML = renderIntegrationStatus(data.status);
        }
      } catch {
        // Silently fail — heartbeat is diagnostic
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  // --- New contract form: outcome slider ---
  const outcomeSlider = document.querySelector("[data-outcome-slider]");
  const outcomeDisplay = document.querySelector("[data-outcome-display]");
  if (outcomeSlider && outcomeDisplay) {
    outcomeSlider.addEventListener("input", () => {
      outcomeDisplay.textContent = outcomeSlider.value;
    });
  }

  // --- New contract form: submit ---
  const contractForm = document.querySelector("[data-contract-form]");
  if (contractForm) {
    contractForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = contractForm.querySelector("button[type='submit']");
      const errorEl = contractForm.querySelector("[data-form-error]");

      if (errorEl) errorEl.classList.add("hidden");
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Creating…';
      }

      const formData = new FormData(contractForm);
      const body = Object.fromEntries(formData.entries());

      // Convert outcomeTarget to number
      body.outcomeTarget = parseInt(body.outcomeTarget, 10);
      if (body.budgetCapUsd) {
        body.budgetCapUsd = body.budgetCapUsd;
      } else {
        delete body.budgetCapUsd;
      }
      if (body.termMonths) {
        body.termMonths = parseInt(body.termMonths, 10);
      }
      body.autoRenew = body.autoRenew === "on";

      try {
        const res = await fetch("/api/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (res.ok) {
          window.location.href = `/app/contracts/${data.id}`;
        } else {
          if (errorEl) {
            errorEl.classList.remove("hidden");
            errorEl.textContent = data.error?.message || "Failed to create contract";
          }
        }
      } catch {
        if (errorEl) {
          errorEl.classList.remove("hidden");
          errorEl.textContent = "Network error — please try again";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // --- Activate contract ---
  const activateBtn = document.querySelector("[data-activate-contract]");
  if (activateBtn) {
    activateBtn.addEventListener("click", async () => {
      const contractId = activateBtn.dataset.activateContract;
      const originalText = activateBtn.textContent;
      activateBtn.disabled = true;
      activateBtn.innerHTML = '<span class="spinner"></span> Activating…';

      try {
        const res = await fetch(`/api/contracts/${contractId}/activate`, { method: "POST" });
        if (res.ok) {
          window.location.reload();
        } else {
          const data = await res.json();
          alert(data.error?.message || "Activation failed");
        }
      } catch {
        alert("Network error — please try again");
      } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = originalText;
      }
    });
  }
});

function renderIntegrationStatus(status) {
  const map = {
    healthy: '<span class="badge badge-healthy">HEALTHY</span>',
    expired: '<span class="badge badge-expired">EXPIRED</span>',
    degraded: '<span class="badge badge-degraded">DEGRADED</span>',
  };
  return map[status] || `<span class="badge badge-pending">${status}</span>`;
}
