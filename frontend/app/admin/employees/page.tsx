"use client";

import { useEffect, useState } from "react";
import { fetchEmployees, updateEmployeeHotelRole } from "../../../lib/api";
import { useRequireAuth } from "../../../lib/auth";
import { HOTEL_ROLE_OPTIONS, type EmployeeRow } from "../../../lib/types";
import LoadingScreen from "../../../components/LoadingScreen";
import SaveButton from "../../../components/SaveButton";
import SavingOverlay from "../../../components/SavingOverlay";

export default function AdminEmployeesPage() {
  const { user, loading } = useRequireAuth(undefined, true);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = () => {
    fetchEmployees()
      .then((d) => setEmployees(d.employees))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    load();
  }, [loading, user]);

  const onSave = async (employee: EmployeeRow, hotelRole: string) => {
    setError(null);
    setMessage(null);
    setSavingId(employee.id);
    try {
      await updateEmployeeHotelRole(employee.id, hotelRole || null);
      setMessage(`Updated hotel role for ${employee.display_name}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user || user.role !== "admin") return null;
  const filtered = employees.filter((emp) =>
    emp.display_name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const missingAuthWithRole = employees.filter(
    (emp) => emp.hotel_role && emp.has_user_auth === false
  );

  return (
    <main className="page">
      <div className={`card card-wide${savingId !== null ? " card-saving" : ""}`}>
        {savingId !== null && <SavingOverlay />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Employee Hotel Roles</h1>
            <p className="page-subtitle">
              Assign hotel app access per employee. Create{" "}
              <code>user_auth</code> with the same <code>id</code> as{" "}
              <code>employee</code> (and PIN) in payroll before clerks can sign in.
              Payroll ADMIN always has full hotel access.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {missingAuthWithRole.length > 0 && (
          <div className="alert error">
            {missingAuthWithRole.length} employee(s) have a hotel role but no login PIN
            row: {missingAuthWithRole.map((e) => e.display_name).join(", ")}. Add{" "}
            <code>user_auth</code> with matching <code>id</code> before they can log in.
          </div>
        )}
        <div className="filters">
          <label className="field">
            <span>Search employee</span>
            <input
              type="text"
              value={query}
              placeholder="Type employee name..."
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => setQuery("")}>
            Reset
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Payroll role</th>
                <th>Login</th>
                <th>Hotel role</th>
                <th>Effective access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <EmployeeRoleRow
                  key={emp.id}
                  employee={emp}
                  saving={savingId === emp.id}
                  onSave={onSave}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="empty-state">No employees found.</p>}
        </div>
      </div>
    </main>
  );
}

function EmployeeRoleRow({
  employee,
  saving,
  onSave,
}: {
  employee: EmployeeRow;
  saving: boolean;
  onSave: (employee: EmployeeRow, hotelRole: string) => void;
}) {
  const [hotelRole, setHotelRole] = useState(employee.hotel_role || "");
  useEffect(() => setHotelRole(employee.hotel_role || ""), [employee.hotel_role]);

  const isPayrollAdmin = employee.payroll_role === "ADMIN";
  const effectiveLabel =
    HOTEL_ROLE_OPTIONS.find((opt) => opt.value === employee.effective_hotel_role)?.label ||
    (isPayrollAdmin ? "admin (payroll)" : "none");
  const hasAuth = employee.has_user_auth !== false;
  const nameMismatch =
    hasAuth &&
    employee.auth_first_name &&
    employee.auth_first_name.toLowerCase() !== employee.first_name.toLowerCase();

  return (
    <tr className={!hasAuth && employee.hotel_role ? "bar-preview-row-warn" : undefined}>
      <td>{employee.display_name}</td>
      <td>{employee.payroll_role}</td>
      <td>
        {hasAuth ? (
          <>
            Ready
            {nameMismatch ? (
              <small style={{ display: "block", color: "#f59e0b" }}>
                Auth name: {employee.auth_first_name} (login uses this)
              </small>
            ) : null}
          </>
        ) : (
          "Missing PIN"
        )}
      </td>
      <td>
        <select
          className="input-cell"
          value={hotelRole}
          onChange={(e) => setHotelRole(e.target.value)}
          disabled={isPayrollAdmin}
          aria-label="Hotel role"
        >
          {HOTEL_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value || "none"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
      <td>{effectiveLabel}</td>
      <td>
        {!isPayrollAdmin && (
          <SaveButton saving={saving} onClick={() => onSave(employee, hotelRole)} />
        )}
      </td>
    </tr>
  );
}
