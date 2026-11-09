"use client";
import { useState } from "react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: code }) });
    if (r.ok) window.location.href = "/";
    else setError("That passcode didn't work.");
  }
  return (
    <div className="login" style={{ gridColumn: "1 / -1" }}>
      <form className="card stack" style={{ width: 340 }} onSubmit={submit}>
        <div className="logo" style={{ padding: 0 }}>theo<span>.organizer</span></div>
        <input className="input" type="password" autoFocus placeholder="Passcode" value={code} onChange={(e) => setCode(e.target.value)} />
        {error && <div className="err">{error}</div>}
        <button className="btn primary">Unlock</button>
      </form>
    </div>
  );
}
