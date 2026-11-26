import { useState } from "react";
import {
  UserRound,
  Mail,
  ShieldCheck,
  Pencil,
  Save,
  X,
  Phone,
  BriefcaseBusiness,
  CheckCircle2,
} from "lucide-react";
import "./OperationsProfile.css";

function formFromUser(user) {
  return {
    name: user?.name || "Operations Staff",
    phone: user?.phone || "",
    department: "Operations",
  };
}

function OperationsProfile({ user }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(() => formFromUser(user));
  const [message, setMessage] = useState("");

  const userKey = [user?.name, user?.phone, user?.email].join("|");
  const [shownUserKey, setShownUserKey] = useState(userKey);

  if (userKey !== shownUserKey) {
    setShownUserKey(userKey);
    setSaved(null);
    setForm(formFromUser(user));
    setEditing(false);
    setMessage("");
  }

  const profile = saved || form;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleSave(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage("Name is required.");
      return;
    }

    setSaved({
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
    });
    setEditing(false);
    setMessage("Profile preferences saved for this page.");
  }

  function handleCancel() {
    setForm(profile);
    setEditing(false);
    setMessage("");
  }

  const initials = (profile.name || "Operations Staff")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="ops-profile">
      <div className="ops-profile-heading">
        <div>
          <span className="ops-profile-eyebrow">
            <UserRound size={16} />
            OPERATIONS ACCOUNT
          </span>
          <h1>My Profile</h1>
          <p>View your account and manage profile preferences.</p>
        </div>
      </div>

      <section className="ops-profile-card">
        <div className="ops-profile-cover" />

        <div className="ops-profile-identity">
          <div className="ops-profile-avatar">
            {initials}
          </div>

          <div className="ops-profile-user">
            <h2>{profile.name}</h2>
            <p>{user?.email || "Email not available"}</p>
            <span className="ops-profile-role">
              <ShieldCheck size={14} />
              {user?.role || "Operations"}
            </span>
          </div>

          {!editing && (
            <button
              type="button"
              className="ops-profile-edit"
              onClick={() => {
                setEditing(true);
                setMessage("");
              }}
            >
              <Pencil size={16} />
              Edit Profile
            </button>
          )}
        </div>

        <form onSubmit={handleSave}>
          <div className="ops-profile-section">
            <h3>Personal Information</h3>
            <p>Your Operations profile details</p>

            <div className="ops-profile-grid">
              <label className="ops-profile-field">
                <span>
                  <UserRound size={15} />
                  Full Name
                </span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editing}
                  maxLength={100}
                  required
                />
              </label>

              <label className="ops-profile-field">
                <span>
                  <Mail size={15} />
                  Email Address
                </span>
                <input
                  value={user?.email || ""}
                  disabled
                  placeholder="Not available"
                />
              </label>

              <label className="ops-profile-field">
                <span>
                  <Phone size={15} />
                  Phone Number
                </span>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Enter phone number"
                  maxLength={20}
                />
              </label>

              <label className="ops-profile-field">
                <span>
                  <BriefcaseBusiness size={15} />
                  Department
                </span>
                <input value="Operations" disabled />
              </label>

              <label className="ops-profile-field">
                <span>
                  <ShieldCheck size={15} />
                  Account Role
                </span>
                <input
                  value={user?.role || "Operations"}
                  disabled
                />
              </label>
            </div>
          </div>

          {message && (
            <div
              className="ops-profile-message"
              role="status"
            >
              <CheckCircle2 size={17} />
              {message}
            </div>
          )}

          {editing && (
            <div className="ops-profile-actions">
              <button
                type="button"
                className="ops-profile-cancel"
                onClick={handleCancel}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                type="submit"
                className="ops-profile-save"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          )}
        </form>
      </section>

      <p className="ops-profile-note">
        Changes made here are temporary and are not
        saved to the server.
      </p>
    </div>
  );
}

export default OperationsProfile;
