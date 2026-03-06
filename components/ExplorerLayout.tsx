import { ReactNode } from "react";

type ExplorerLayoutProps = {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
};

export default function ExplorerLayout({ left, middle, right }: ExplorerLayoutProps) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr 380px",
        gap: 12,
        minHeight: "68vh",
      }}
    >
      {left}
      {middle}
      {right}
    </section>
  );
}
