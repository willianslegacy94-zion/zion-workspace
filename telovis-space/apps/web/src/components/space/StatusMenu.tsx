"use client";

import { useEffect, useRef, useState } from "react";
import {
  AUTO_AWAY_MS,
  AWAY_STATUS_LABELS,
  AWAY_STATUSES,
  type AwayStatus,
} from "@telovis/protocol";
import type { SceneStatus } from "@/game/scenes/OfficeScene";
import type { SpaceSocket } from "@/lib/space/socket";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel"] as const;
const AUTO_AWAY_CHECK_MS = 15_000;

/**
 * Status de ausência: escolha manual no menu, ou automático depois de
 * AUTO_AWAY_MS sem teclado/mouse. O automático some sozinho na próxima
 * atividade; o manual só sai quando a pessoa escolhe "Disponível".
 *
 * O servidor esquece o status a cada reconexão, então ele é reenviado sempre
 * que a cena volta a ficar "joined".
 */
export default function StatusMenu({
  socket,
  connection,
}: {
  socket: SpaceSocket;
  connection: SceneStatus["kind"];
}) {
  const [status, setStatus] = useState<AwayStatus | null>(null);
  const [open, setOpen] = useState(false);
  const auto = useRef(false);
  const lastActivity = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Envia a cada mudança e a cada (re)entrada na sala.
  useEffect(() => {
    if (connection !== "joined") return;
    socket.emit("status:set", { status });
  }, [socket, status, connection]);

  useEffect(() => {
    lastActivity.current = Date.now();
    const onActivity = () => {
      lastActivity.current = Date.now();
      if (auto.current) {
        auto.current = false;
        setStatus(null);
      }
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current < AUTO_AWAY_MS) return;
      setStatus((current) => {
        if (current) return current; // manual ou já ausente: não mexe
        auto.current = true;
        return "away";
      });
    }, AUTO_AWAY_CHECK_MS);
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
      clearInterval(timer);
    };
  }, []);

  // Fecha o menu ao clicar fora ou com Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: AwayStatus | null) => {
    auto.current = false;
    setStatus(next);
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="pointer-events-auto relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur hover:bg-black/80"
      >
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${status ? "bg-amber-400" : "bg-emerald-400"}`}
        />
        {status ? AWAY_STATUS_LABELS[status] : "Disponível"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 py-1 text-sm shadow-xl"
        >
          {[null, ...AWAY_STATUSES].map((option) => (
            <button
              key={option ?? "available"}
              type="button"
              role="menuitemradio"
              aria-checked={status === option}
              onClick={() => choose(option)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800"
            >
              <span
                aria-hidden
                className={`size-2 rounded-full ${option ? "bg-amber-400" : "bg-emerald-400"}`}
              />
              {option ? AWAY_STATUS_LABELS[option] : "Disponível"}
              {status === option && <span className="ml-auto text-emerald-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
