"use client";

type JoinTeamButtonProps = {
  status: "none" | "pending" | "active" | "rejected";
  role: "athlete" | "coach" | "staff";
  disabled?: boolean;
  onJoin: (role: "athlete" | "coach" | "staff") => void;
};

export default function JoinTeamButton({
  status,
  role,
  disabled = false,
  onJoin,
}: JoinTeamButtonProps) {
  if (status === "active") {
    return (
      <button
        disabled
        className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
      >
        Member
      </button>
    );
  }

  if (status === "pending") {
    return (
      <button
        disabled
        className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100"
      >
        Pending
      </button>
    );
  }

  return (
    <button
      onClick={() => onJoin(role)}
      disabled={disabled}
      className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-60"
    >
      Join Team
    </button>
  );
}
