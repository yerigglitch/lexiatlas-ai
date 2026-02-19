type InlineAlertProps = {
  tone: "success" | "error" | "info";
  children: React.ReactNode;
};

export default function InlineAlert({ tone, children }: InlineAlertProps) {
  return <p className={`ui-inline-alert ${tone}`}>{children}</p>;
}
