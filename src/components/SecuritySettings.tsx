import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hasPin,
  setPin as savePin,
  removePin,
  hasBiometric,
  biometricSupported,
  registerBiometric,
  removeBiometric,
} from "@/lib/security-store";

export function SecuritySettings() {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPinEnabled(hasPin());
    setBioEnabled(hasBiometric());
    setBioSupported(biometricSupported());
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 3000);
  };

  const handleSavePin = async () => {
    if (pin.length < 4 || pin.length > 6) {
      flash("PIN deve ter entre 4 e 6 dígitos");
      return;
    }
    if (pin !== confirmPin) {
      flash("Os PINs não coincidem");
      return;
    }
    await savePin(pin);
    setPinEnabled(true);
    setShowSetup(false);
    setPin("");
    setConfirmPin("");
    flash("✅ PIN configurado");
  };

  const handleRemovePin = () => {
    if (!confirm("Remover o PIN? O app não pedirá mais bloqueio.")) return;
    removePin();
    setPinEnabled(false);
    setBioEnabled(false);
    flash("PIN removido");
  };

  const handleEnableBio = async () => {
    if (!pinEnabled) {
      flash("Configure um PIN primeiro");
      return;
    }
    const ok = await registerBiometric();
    if (ok) {
      setBioEnabled(true);
      flash("✅ Biometria ativada");
    } else {
      flash("❌ Não foi possível registrar a biometria");
    }
  };

  const handleDisableBio = () => {
    removeBiometric();
    setBioEnabled(false);
    flash("Biometria desativada");
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          {pinEnabled ? (
            <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
          ) : (
            <ShieldOff className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h2 className="text-base md:text-lg font-medium mb-1">PIN de acesso</h2>
            <p className="text-xs text-muted-foreground">
              {pinEnabled
                ? "O app pedirá o PIN ao abrir."
                : "Proteja o app com um PIN de 4 a 6 dígitos."}
            </p>
          </div>
        </div>

        {!pinEnabled && !showSetup && (
          <Button onClick={() => setShowSetup(true)}>
            <KeyRound className="size-4" />
            Configurar PIN
          </Button>
        )}

        {showSetup && (
          <div className="space-y-3 mt-2">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Novo PIN (4–6 dígitos)"
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Confirmar PIN"
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSetup(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSavePin} className="flex-1">
                Salvar
              </Button>
            </div>
          </div>
        )}

        {pinEnabled && !showSetup && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSetup(true)}>
              Alterar PIN
            </Button>
            <Button variant="destructive" onClick={handleRemovePin}>
              Remover PIN
            </Button>
          </div>
        )}
      </div>

      <div className="glass-card p-4 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Fingerprint className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base md:text-lg font-medium mb-1">Biometria</h2>
            <p className="text-xs text-muted-foreground">
              {!bioSupported
                ? "Seu dispositivo não suporta biometria neste navegador."
                : bioEnabled
                ? "Use Face ID / Touch ID / digital para desbloquear."
                : "Desbloqueie com Face ID, Touch ID ou digital."}
            </p>
          </div>
        </div>

        {bioSupported && (
          bioEnabled ? (
            <Button variant="outline" onClick={handleDisableBio}>
              Desativar biometria
            </Button>
          ) : (
            <Button onClick={handleEnableBio} disabled={!pinEnabled}>
              <Fingerprint className="size-4" />
              Ativar biometria
            </Button>
          )
        )}
        {!pinEnabled && bioSupported && !bioEnabled && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Configure um PIN primeiro (usado como fallback).
          </p>
        )}
      </div>

      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}
