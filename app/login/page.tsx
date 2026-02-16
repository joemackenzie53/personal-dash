"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/Notice";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function submit() {
    setErr(null);
    setOkMsg(null);
    setLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      setOkMsg("Logged in.");
      router.push("/now");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Enter the app password. (If no password is configured, this step is optional.)
        </p>
      </div>

      {err && <Notice tone="red">{err}</Notice>}
      {okMsg && <Notice tone="green">{okMsg}</Notice>}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">App password</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <Button onClick={submit} disabled={loading}>Log in</Button>
        </CardContent>
      </Card>
    </div>
  );
}
