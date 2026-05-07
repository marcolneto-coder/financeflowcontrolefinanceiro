import { useEffect, useState } from "react";
import { Fingerprint, Lock, Delete } from "lucide-react";
import {
  verifyPin,
  hasBiometric,
  authenticateBiometric,
  markUnlocked,
} from "@/lib/security-store";

interface Props {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const bioAvailable = hasBiometric();

  useEffect(() => {
    // Auto-trigger biometric if available
    if (bioAvailable) {
      tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryBiometric = async () => {
    const ok = await authenticateBiometric();
    if (ok) {
      markUnlocked();
      onUnlock();
    }
  };

  const submit = async (val: string) => {
    const ok = await verifyPin(val);
    if (ok) {
      markUnlocked();
      onUnlock();
    } else {
      setError("PIN incorreto");
      setPin("");
      setTimeout(() => setError(""), 1500);
    }
  };

  const press = (n: string) => {
    if (pin.length >= 6) return;
    const next = pin + n;
    setPin(next);
    if (next.length >= 4) {
      // try after 4 (also try at 6)
      // we don't know the user's chosen length, so verify on each input >=4
      submit(next);
    }
  };

  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6">
      <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Lock className="size-7 text-primary" />
      </div>
      <h1 className="text-xl font-semibold mb-2">Finance Flow</h1>
      <p className="text-sm text-muted-foreground mb-8">Digite seu PIN para continuar</p>

      <div className="flex gap-3 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`size-3 rounded-full transition-colors ${
              i < pin.length ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-3 max-w-[280px] w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => press(String(n))}
            className="aspect-square rounded-2xl bg-muted hover:bg-accent text-2xl font-light transition-colors"
          >
            {n}
          </button>
        ))}
        <button
          onClick={tryBiometric}
          disabled={!bioAvailable}
          className="aspect-square rounded-2xl bg-muted hover:bg-accent flex items-center justify-center transition-colors disabled:opacity-30"
          title="Biometria"
        >
          <Fingerprint className="size-6" />
        </button>
        <button
          onClick={() => press("0")}
          className="aspect-square rounded-2xl bg-muted hover:bg-accent text-2xl font-light transition-colors"
        >
          0
        </button>
        <button
          onClick={back}
          className="aspect-square rounded-2xl bg-muted hover:bg-accent flex items-center justify-center transition-colors"
        >
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  );
}
