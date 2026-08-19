type Props = {
  connectedLabel: string;
  compact?: boolean;
};

export function UserBadge({ connectedLabel, compact = false }: Props) {
  return (
    <div className={compact ? "user-badge compact" : "user-badge"}>
      <div className="avatar">AC</div>
      {!compact && (
        <div>
          <div className="user-name">Arthur Campos</div>
          <div className="user-state"><span className="online-dot" />{connectedLabel}</div>
        </div>
      )}
    </div>
  );
}
