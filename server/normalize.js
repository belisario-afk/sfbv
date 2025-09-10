export function normalizeEvent(type, data) {
  const ts = Date.now()
  if (type === 'chat') {
    return {
      type: 'chat',
      userId: data?.user?.secUid || data?.user?.userId || data?.userId || '',
      username: '@' + (data?.user?.uniqueId || data?.uniqueId || 'unknown'),
      displayName: data?.user?.nickname || data?.nickname || '',
      avatarUrl: data?.user?.profilePictureUrl || '',
      text: data?.comment || data?.text || '',
      ts
    }
  }
  if (type === 'gift') {
    return {
      type: 'gift',
      userId: data?.user?.secUid || data?.user?.userId || '',
      username: '@' + (data?.user?.uniqueId || 'unknown'),
      displayName: data?.user?.nickname || '',
      avatarUrl: data?.user?.profilePictureUrl || '',
      value: data?.gift?.diamond_count || data?.repeatCount || 1,
      giftName: data?.gift?.name || '',
      ts
    }
  }
  if (type === 'like') {
    return {
      type: 'like',
      userId: data?.userId || data?.user?.secUid || '',
      username: '@' + (data?.uniqueId || data?.user?.uniqueId || 'unknown'),
      displayName: data?.nickname || data?.user?.nickname || '',
      avatarUrl: data?.profilePictureUrl || data?.user?.profilePictureUrl || '',
      ts
    }
  }
  if (type === 'subscribed') {
    return {
      type: 'subscribed',
      userId: data?.userId || data?.user?.secUid || '',
      username: '@' + (data?.uniqueId || data?.user?.uniqueId || 'unknown'),
      displayName: data?.nickname || data?.user?.nickname || '',
      avatarUrl: data?.profilePictureUrl || data?.user?.profilePictureUrl || '',
      ts
    }
  }
  return { type: 'room_info', text: '[unknown event]', ts }
}