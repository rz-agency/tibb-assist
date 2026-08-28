function StatusMessage({ children, tone = 'error' }) {
  return (
    <p className={tone === 'success' ? 'status-message status-success' : 'status-message'} role="status">
      {children}
    </p>
  )
}

export default StatusMessage
