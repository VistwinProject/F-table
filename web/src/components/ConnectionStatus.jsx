export default function ConnectionStatus({ wsStatus }) {
  if (wsStatus !== 'disconnected') return null
  return (
    <div className="ws-badge">WS OFFLINE</div>
  )
}
