// SaveButton.tsx
import "./SaveButton.css";

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  width?: string;   // 기본 4vw
  height?: string;  // 기본 4vh
  emphasized?: boolean; // SAP UI5 Emphasized 느낌
  title?: string;
};

export default function SaveButton({
  onClick,
  disabled = false,
  loading = false,
  width = "4vw",
  height = "4vh",
  emphasized = true,
  title = "Save",
}: Props) {
  const cls = [
    "ui5like-btn",
    emphasized ? "ui5like-btn--emphasized" : "ui5like-btn--standard",
    disabled ? "is-disabled" : "",
    loading ? "is-loading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      style={{ width, height, fontSize: "0.9vw" }}
      onClick={disabled || loading ? undefined : onClick}
      aria-disabled={disabled}
      aria-busy={loading}
    >
      {loading ? <span className="spinner" aria-hidden /> : null}
      <span className="label">{title}</span>
    </button>
  );
}
