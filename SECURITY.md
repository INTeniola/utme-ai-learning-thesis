# Mentat Tutor Security & Compliance

This document outlines the technical and administrative controls protecting the Mentat Tutor platform, specifically focusing on the AI trust layer.

---

## 1. Data Security (Layer 1)

### **Row Level Security (RLS)**
- Every database table in our Supabase instance enforces strict **Row Level Security**.
- Student data is isolated by `auth.uid()`. No cross-tenant access is possible at the database layer.

### **Encryption**
- **In Transit**: All traffic is encrypted via TLS 1.3.
- **At Rest**: Student documents and chat histories are encrypted using AES-256.

### **PII Masking**
- We implement an **Automated PII Scrubber** in the AI Gateway.
- Common sensitive data like **Nigerian Phone Numbers** (`+234...`) and **Emails** are masked (e.g., `[PHONE_MASKED]`) before being sent to any LLM provider.

---

## 2. Prompt & Input Security (Layer 2)

### **Active Guardrails**
- Every student query undergoes a **Safety Guardrail Pass** using a dedicated security model.
- We specifically detect and block:
    - **Prompt Injection**: Attempts to hijack the AI's instructions.
    - **System Leakage**: Verbal probes for the underlying system prompt.
    - **Adversarial Commands**: Instructions to ignore safety constraints.

### **Session Isolation**
- AI "memory" is strictly limited to the current `conversation_id`. There is zero semantic leakage between different student sessions.

---

## 3. Model & Infrastructure (Layer 3)

### **Model Pinning**
- We use specific, version-locked model identifiers (e.g., `gemini-2.0-flash`). This prevents "model drift" from introducing unexpected security vulnerabilities during silent upgrades.

### **Rate Limiting**
- Multi-tier rate limiting is enforced at the Gateway level to prevent Denial of Service (DoS) attacks and credit exhaustion.

---

## 4. Compliance Mapping

| Framework | Control Implementation |
| :--- | :--- |
| **GDPR** | Right to erasure (cascading deletes), PII minimization (Scrubber), RLS isolation. |
| **SOC 2** | Audit logs (`ai_usage_logs`), RBAC, Encryption-at-rest. |
| **EU AI Act** | Transparency (Tutor identity), High-risk input filtering (Guardrails). |

---

> [!IMPORTANT]
> **Reporting Vulnerabilities**: If you discover a security flaw, please report it immediately to the Mentat Engineering team.
