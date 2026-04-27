import dayjs from 'dayjs';

export const formatTime = (iso: string) => dayjs(iso).format('HH:mm:ss');
export const formatDateTime = (iso: string) => dayjs(iso).format('YYYY-MM-DD HH:mm:ss');
export const formatRelative = (iso: string) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return dayjs(iso).format('MMM D, HH:mm');
};
