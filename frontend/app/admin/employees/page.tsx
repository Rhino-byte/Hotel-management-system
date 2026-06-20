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

  return (
    <main className="page">
      <div className={`card card-wide${savingId !== null ? " card-saving" : ""}`}>
        {savingId !== null && <SavingOverlay />}
        <div className="page-header">
          <div>
            <h1 className="page-title">Employee Hotel Roles</h1>
            <p className="page-subtitle">
              Assign hotel app access per employee. Payroll ADMIN always has full hotel access.
            </p>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
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

  return (
    <tr>
      <td>{employee.display_name}</td>
      <td>{employee.payroll_role}</td>
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
      <td>{employee.effective_hotel_role || (isPayrollAdmin ? "admin (payroll)" : "none")}</td>
      <td>
        {!isPayrollAdmin && (
          <SaveButton saving={saving} onClick={() => onSave(employee, hotelRole)} />
        )}
      </td>
    </tr>
  );
}
