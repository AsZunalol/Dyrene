"use client";

import { useState } from "react";

type RoleOption = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  last_seen: string | null;
  created_at: string | null;
  online: boolean;
  currentRoles: RoleOption[];
};

type Props = {
  users: Profile[];
  assignableRoles: RoleOption[];
};

export default function AdminUsersTable({
  users,
  assignableRoles,
}: Props) {
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const handleRoleChange = (userId: string, roleId: string) => {
    setSelectedRoles((prev) => ({
      ...prev,
      [userId]: roleId,
    }));
  };

  const handleRoleAction = async (
    discordUserId: string,
    profileId: string,
    action: "add" | "remove"
  ) => {
    const roleId = selectedRoles[profileId];

    if (!roleId) {
      setMessage("Please select a role first.");
      return;
    }

    setLoadingUserId(profileId);
    setMessage("");

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          discordUserId,
          roleId,
          action,
        }),
      });

      const text = await res.text();

      let data: any = null;

      try {
        data = JSON.parse(text);
      } catch {
        console.error("Non-JSON response from /api/admin/roles:", text);
        throw new Error("Server returned HTML instead of JSON.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update role");
      }

      setMessage(
        action === "add"
          ? "Role added successfully. Refresh to see updated roles."
          : "Role removed successfully. Refresh to see updated roles."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <div
      className="rounded-2xl border border-white/10 shadow-lg overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        backdropFilter: "blur(10px)",
      }}
    >
      {message && (
        <div className="px-6 py-4 border-b border-white/10 text-sm text-white bg-white/5">
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-white">
          <thead className="border-b border-white/10 text-gray-300">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Discord ID</th>
              <th className="px-6 py-4">Admin</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Current Roles</th>
              <th className="px-6 py-4">Last Seen</th>
              <th className="px-6 py-4">Manage Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((profile) => {
              const isLoading = loadingUserId === profile.id;

              return (
                <tr
                  key={profile.id}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.discord_username || "User avatar"}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                          {(profile.discord_username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <div className="font-semibold text-white">
                          {profile.global_name || profile.discord_username || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-400">
                          @{profile.discord_username || "unknown"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-gray-300">
                    {profile.discord_id || "—"}
                  </td>

                  <td className="px-6 py-4">
                    {profile.is_admin ? (
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/20">
                        Admin
                      </span>
                    ) : (
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-white/10 text-gray-300 border border-white/10">
                        Member
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {profile.online ? (
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                        Online
                      </span>
                    ) : (
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-white/10 text-gray-300 border border-white/10">
                        Offline
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {profile.currentRoles.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.currentRoles.map((role) => (
                          <span
                            key={role.id}
                            className="rounded-full px-3 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20"
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">No assignable roles</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-gray-300">
                    {profile.last_seen
                      ? new Date(profile.last_seen).toLocaleString()
                      : "—"}
                  </td>

                  <td className="px-6 py-4">
                    {profile.discord_id ? (
                      <div className="flex flex-col gap-2 min-w-[220px]">
                        <select
                          value={selectedRoles[profile.id] || ""}
                          onChange={(e) =>
                            handleRoleChange(profile.id, e.target.value)
                          }
                          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 outline-none"
                        >
                          <option value="" className="text-black">
                            Select role
                          </option>
                          {assignableRoles.map((role) => (
                            <option
                              key={role.id}
                              value={role.id}
                              className="text-black"
                            >
                              {role.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleRoleAction(profile.discord_id!, profile.id, "add")
                            }
                            disabled={isLoading}
                            className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                            style={{
                              background: "linear-gradient(90deg,#10b981,#059669)",
                            }}
                          >
                            {isLoading ? "Working..." : "Add"}
                          </button>

                          <button
                            onClick={() =>
                              handleRoleAction(
                                profile.discord_id!,
                                profile.id,
                                "remove"
                              )
                            }
                            disabled={isLoading}
                            className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                            style={{
                              background: "linear-gradient(90deg,#ef4444,#dc2626)",
                            }}
                          >
                            {isLoading ? "Working..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">No Discord ID</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                  No users found yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}