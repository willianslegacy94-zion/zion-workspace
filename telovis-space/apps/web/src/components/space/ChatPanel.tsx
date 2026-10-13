"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_MAX_LENGTH, type ChatMessage } from "@telovis/protocol";
import type { NearbyPeer } from "@/game/scenes/OfficeScene";
import type { SpaceSocket } from "@/lib/space/socket";

type Line =
  | { kind: "message"; message: ChatMessage; mine: boolean }
  | { kind: "system"; id: string; text: string };

const MAX_LINES = 60;

/**
 * Chat por proximidade. O filtro de quem recebe é do servidor; aqui só
 * listamos o que chegou. Enter foca o campo, Esc devolve o foco ao jogo.
 */
export default function ChatPanel({
  socket,
  nearby,
}: {
  socket: SpaceSocket;
  nearby: NearbyPeer[];
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const push = (line: Line) => setLines((prev) => [...prev, line].slice(-MAX_LINES));

  useEffect(() => {
    const onMessage = (message: ChatMessage) =>
      push({ kind: "message", message, mine: message.playerId === socket.id });
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || document.activeElement === inputRef.current) return;
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    socket.emit("chat:send", { text }, (res) => {
      if (!res.ok) {
        push({ kind: "system", id: crypto.randomUUID(), text: res.error });
        return;
      }
      if (res.delivered === 0) {
        push({
          kind: "system",
          id: crypto.randomUUID(),
          text: "Ninguém por perto ouviu. Chegue mais perto de alguém.",
        });
      }
    });
    setDraft("");
  }

  return (
    <section className="flex w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-lg bg-black/60 text-sm backdrop-blur">
      <div className="border-b border-white/10 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Perto de você</p>
        {nearby.length === 0 ? (
          <p className="text-slate-500">Ninguém por perto</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1">
            {nearby.map((p) => (
              <li key={p.id} className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">
                {p.name}{" "}
                <span className="text-xs text-emerald-300/70">
                  {p.reason === "same-zone" ? "sala" : `${p.distance}px`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul ref={listRef} className="max-h-48 min-h-16 space-y-1 overflow-y-auto px-3 py-2">
        {lines.length === 0 && (
          <li className="text-slate-500">Mensagens chegam só a quem está perto.</li>
        )}
        {lines.map((line) =>
          line.kind === "system" ? (
            <li key={line.id} className="text-xs italic text-amber-300/80">
              {line.text}
            </li>
          ) : (
            <li key={line.message.id} className="break-words">
              <span className={line.mine ? "text-emerald-300" : "text-sky-300"}>
                {line.mine ? "Você" : line.message.name}:
              </span>{" "}
              {line.message.text}
            </li>
          ),
        )}
      </ul>

      <form
        className="border-t border-white/10 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Enter para conversar…"
          className="w-full rounded-md bg-white/10 px-2 py-1.5 outline-none placeholder:text-slate-500 focus:bg-white/15"
        />
      </form>
    </section>
  );
}
