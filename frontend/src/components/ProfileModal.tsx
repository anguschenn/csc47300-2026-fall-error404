import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useAuth } from '../context/useAuth'
import type { Station } from '../types/station'
import type { Profile, ProfileUpdate } from '../types/profile'
import type { User } from '@supabase/supabase-js'
import './ProfileModal.css'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  stations: Station[]
}

interface ProfileModalContentProps {
  user: User | null
  profile: Profile | null
  stations: Station[]
  onClose: () => void
}

function ProfileModalContent({ user, profile, stations, onClose }: ProfileModalContentProps) {
  const { updateProfile, uploadAvatar, signOut } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(
    profile?.display_name || profile?.full_name || user?.user_metadata?.full_name || ''
  )
  const [homeStationId, setHomeStationId] = useState(profile?.home_station_id || '')
  const [workStationId, setWorkStationId] = useState(profile?.work_station_id || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const headerTitle =
    displayName ||
    profile?.display_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    'Commuter Profile'

  const currentAvatarSrc = removeAvatar ? null : (previewUrl || profile?.avatar_url)

  const sortedStations = [...stations].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name)
    if (nameCompare !== 0) return nameCompare
    return (a.lines?.[0] || '').localeCompare(b.lines?.[0] || '')
  })

  const formatStationLabel = (st: Station) => {
    const lines = st.lines && st.lines.length > 0 ? ` (${st.lines.join(', ')})` : ''
    const borough = st.borough ? ` — ${st.borough}` : ''
    return `${st.name}${lines}${borough}`
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']

    if (!allowedTypes.includes(file.type) || !allowedExts.includes(ext)) {
      setMessage({
        text: 'Invalid file format. Please upload a JPG, PNG, WEBP, or GIF image.',
        isError: true
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      setMessage({ text: 'Image file size must be under 4MB.', isError: true })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)

    const blobUrl = URL.createObjectURL(file)
    setAvatarFile(file)
    setPreviewUrl(blobUrl)
    setRemoveAvatar(false)
    setMessage(null)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveAvatar = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setAvatarFile(null)
    setRemoveAvatar(true)
    setMessage(null)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSaving(true)

    try {
      let finalAvatarUrl: string | null | undefined = undefined

      // If user selected a new photo, upload it now
      if (avatarFile) {
        const uploadRes = await uploadAvatar(avatarFile)
        if (uploadRes.error) {
          setMessage({ text: uploadRes.error, isError: true })
          setSaving(false)
          return
        }
        finalAvatarUrl = uploadRes.url
      } else if (removeAvatar) {
        // User clicked Remove
        finalAvatarUrl = null
      }

      const updates: ProfileUpdate = {
        display_name: displayName.trim() || null,
        home_station_id: homeStationId || null,
        work_station_id: workStationId || null
      }

      if (finalAvatarUrl !== undefined) {
        updates.avatar_url = finalAvatarUrl
      }

      const result = await updateProfile(updates)
      if (result.error) {
        setMessage({ text: result.error, isError: true })
      } else {
        setMessage({ text: 'Preferences saved successfully!', isError: false })
        setTimeout(() => {
          onClose()
        }, 800)
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Could not save preferences'
      setMessage({ text: errText, isError: true })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    onClose()
  }

  return (
    <>
      <button className="profile-modal-close" onClick={onClose} aria-label="Close dialog">
        ✕
      </button>

      <div className="profile-header">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar">
            {currentAvatarSrc ? (
              <img src={currentAvatarSrc} alt="Profile" />
            ) : (
              <span>{(headerTitle || user?.email || 'U').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <button
            type="button"
            className="avatar-change-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            title="Choose a profile picture"
          >
            📷
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="profile-info-block">
          <h2 className="profile-title">{headerTitle}</h2>
          <p className="profile-email">{user?.email}</p>
          <div className="avatar-controls">
            <button
              type="button"
              className="avatar-link-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              {avatarFile ? 'Change selection' : 'Change photo'}
            </button>
            {currentAvatarSrc && (
              <button
                type="button"
                className="avatar-link-btn text-danger"
                onClick={handleRemoveAvatar}
                disabled={saving}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className={`profile-banner ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="profile-form">
        <div className="form-group">
          <label htmlFor="profile-display-name">Display Name</label>
          <input
            id="profile-display-name"
            type="text"
            placeholder="e.g. Alex"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="home-station">Home Station</label>
          <select
            id="home-station"
            value={homeStationId}
            onChange={(e) => setHomeStationId(e.target.value)}
          >
            <option value="">-- None selected --</option>
            {sortedStations.map((st) => (
              <option key={st.id} value={st.id}>
                {formatStationLabel(st)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="work-station">Work / School Station</label>
          <select
            id="work-station"
            value={workStationId}
            onChange={(e) => setWorkStationId(e.target.value)}
          >
            <option value="">-- None selected --</option>
            {sortedStations.map((st) => (
              <option key={st.id} value={st.id}>
                {formatStationLabel(st)}
              </option>
            ))}
          </select>
        </div>

        <div className="profile-actions">
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button type="button" className="signout-btn" onClick={handleSignOut} disabled={saving}>
            Sign Out
          </button>
        </div>
      </form>
    </>
  )
}

export function ProfileModal({ isOpen, onClose, stations }: ProfileModalProps) {
  const { user, profile } = useAuth()

  if (!isOpen) return null

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div
        className="profile-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <ProfileModalContent
          key={user?.id || 'anon'}
          user={user}
          profile={profile}
          stations={stations}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
