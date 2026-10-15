"use client";

import { removeMember, updateMemberRole } from "@/app/dashboard/actions";
import type { SpaceRole } from "@telovis/protocol";
import { inputClass, ROLE_LABEL } from "./ui";

export default function MemberActions({
  slug,
  memberId,
  memberName,
  role,
  isSelf,
}: {
  slug: string;
  memberId: string;
  memberName: string;
  role: SpaceRole;
  isSelf: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <form action={updateMemberRole}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <label className="sr-only" htmlFor={`role-${memberId}`}>
          Papel de {memberName}
        </label>
        <select
          id={`role-${memberId}`}
          name="role"
          defaultValue={role}
          onChange={(e) => {
            if (isSelf && role === "ADMIN" && e.target.value !== "ADMIN") {
              if (!confirm("Você vai perder o acesso de administrador. Continuar?")) {
                e.target.value = role;
                return;
              }
            }
            e.target.form?.requestSubmit();
          }}
          className={`${inputClass} py-1 text-sm`}
        >
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>
      <form
        action={removeMember}
        onSubmit={(e) => {
          const msg = isSelf
            ? "Sair deste escritório? Você perde o acesso."
            : `Remover ${memberName} deste escritório?`;
          if (!confirm(msg)) e.preventDefault();
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="memberId" value={memberId} />
        <button type="submit" className="rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-red-500/10">
          Remover
        </button>
      </form>
    </div>
  );
}
