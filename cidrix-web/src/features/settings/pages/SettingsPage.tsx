import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { PageContainer } from '@/shared/components/PageContainer'
import { ApiError } from '@/shared/services/api/api-error'
import { createSettingsApi } from '../api/settings.api'
import type { OrganizationSettings } from '../model/settings.types'
import { canonicalizeTimezone, hasSettingsChanges, isSettingsRequestAborted, settingsErrorMessage } from '../model/settings.utils'

const TIMEZONE_SUGGESTIONS = ['UTC', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid']

interface SettingsState {
  savedSettings: OrganizationSettings | null
  draftTimezone: string
  getError: string | null
  loadAttempt: number
}

function SettingsSessionPage({ canEdit }: { canEdit: boolean }) {
  const client = useAuthenticatedApi()
  const api = useMemo(() => createSettingsApi(client), [client])
  const suggestionsId = useId()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [resource, setResource] = useState<SettingsState>({
    savedSettings: null, draftTimezone: '', getError: null, loadAttempt: -1,
  })
  const [saving, setSaving] = useState(false)
  const saveController = useRef<AbortController | null>(null)
  const [saveError, setSaveError] = useState<{ message: string; field: boolean } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const timezoneRef = useRef<HTMLInputElement>(null)
  const { savedSettings, draftTimezone, getError } = resource
  const loading = resource.loadAttempt !== loadAttempt
  const dirty = hasSettingsChanges(savedSettings, draftTimezone)
  const draftEdited = savedSettings !== null && draftTimezone !== savedSettings.timezone
  const canonicalDraft = canonicalizeTimezone(draftTimezone)
  const fieldError = draftEdited && !canonicalDraft
    ? 'Ingresa una zona horaria IANA válida, por ejemplo America/Lima.'
    : undefined

  useEffect(() => {
    const controller = new AbortController()
    void api.getSettings(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResource({ savedSettings: data, draftTimezone: data.timezone, getError: null, loadAttempt })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isSettingsRequestAborted(error)) return
        setResource((current) => ({ ...current, getError: settingsErrorMessage(error, 'get'), loadAttempt }))
      })
    return () => controller.abort()
  }, [api, loadAttempt])

  useEffect(() => () => saveController.current?.abort(), [])

  function refresh() {
    if (loading || saveController.current || draftEdited) return
    setSaveError(null)
    setAnnouncement('')
    setLoadAttempt((current) => current + 1)
  }

  function cancel() {
    if (!savedSettings || loading || saveController.current) return
    setResource((current) => ({ ...current, draftTimezone: savedSettings.timezone }))
    setSaveError(null)
    setAnnouncement('Cambios descartados.')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !savedSettings || loading || getError || saveController.current || !dirty) return
    if (!canonicalDraft) {
      timezoneRef.current?.focus()
      return
    }
    const controller = new AbortController()
    saveController.current = controller
    setSaving(true)
    setSaveError(null)
    setAnnouncement('')
    try {
      const data = await api.updateSettings({ timezone: draftTimezone.trim() }, controller.signal)
      if (controller.signal.aborted) return
      setResource((current) => ({ ...current, savedSettings: data, draftTimezone: data.timezone }))
      setAnnouncement('Configuración guardada.')
    } catch (error: unknown) {
      if (controller.signal.aborted || isSettingsRequestAborted(error)) return
      const field = error instanceof ApiError && error.status === 400
      setSaveError({ message: settingsErrorMessage(error, 'save'), field })
      if (field) timezoneRef.current?.focus()
    } finally {
      if (!controller.signal.aborted) {
        saveController.current = null
        setSaving(false)
      }
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
          <p className="mt-1 text-sm text-foreground-muted">Configuración regional de la organización.</p>
        </div>
        <Button disabled={loading || saving || draftEdited} onClick={refresh} variant="secondary">Actualizar</Button>
      </div>

      <Card aria-busy={loading || saving} className="mt-6 min-w-0 max-w-3xl">
        <h2 className="text-lg font-semibold text-foreground">Configuración regional</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          La zona horaria es la preferencia regional almacenada de la organización. Las tendencias del Dashboard siguen agrupándose en UTC.
        </p>

        {loading ? (
          <div aria-label="Cargando configuración" className="mt-6 space-y-3" role="status">
            <p className="text-sm text-foreground-muted">{savedSettings ? 'Actualizando configuración…' : 'Cargando configuración…'}</p>
            {!savedSettings ? <div aria-hidden="true" className="h-24 animate-pulse rounded-control bg-surface-muted" /> : null}
          </div>
        ) : null}

        {!loading && getError ? (
          <div className="mt-6 rounded-control border border-danger/30 bg-danger/5 p-4" role="alert">
            <p className="text-sm text-danger">{getError}</p>
            {savedSettings ? <p className="mt-2 text-sm text-foreground-muted">Se muestra el último valor confirmado. Vuelve a cargar antes de editar.</p> : null}
            <Button className="mt-3" onClick={refresh} size="sm" variant="secondary">Reintentar</Button>
          </div>
        ) : null}

        {savedSettings && canEdit && !getError ? (
          <form aria-busy={saving} aria-label="Editar configuración regional" className="mt-6 space-y-5" noValidate onSubmit={(event) => void save(event)}>
            <Input
              aria-describedby={saveError?.field ? 'settings-timezone-description settings-save-error' : 'settings-timezone-description'}
              aria-invalid={fieldError || saveError?.field ? true : undefined}
              autoComplete="off"
              disabled={loading || saving}
              error={fieldError}
              helperText="Usa un nombre IANA, por ejemplo America/Lima. Las sugerencias no son una lista cerrada."
              id="settings-timezone"
              label="Zona horaria"
              list={suggestionsId}
              name="timezone"
              onChange={(event) => {
                const value = event.target.value
                setResource((current) => ({ ...current, draftTimezone: value }))
                setSaveError(null)
                setAnnouncement('')
              }}
              ref={timezoneRef}
              required
              type="text"
              value={draftTimezone}
            />
            <datalist id={suggestionsId}>{TIMEZONE_SUGGESTIONS.map((timezone) => <option key={timezone} value={timezone} />)}</datalist>
            {fieldError ? <p className="sr-only" role="alert">{fieldError}</p> : null}
            <p className="text-sm text-foreground-muted">{dirty ? 'Tienes cambios sin guardar.' : 'No hay cambios pendientes.'}</p>
            {saveError ? <p className="text-sm text-danger" id="settings-save-error" role="alert">{saveError.message}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button disabled={!draftEdited || loading || saving} onClick={cancel} variant="secondary">Cancelar</Button>
              <Button disabled={!dirty || !canonicalDraft || loading || saving} isLoading={saving} type="submit">Guardar cambios</Button>
            </div>
          </form>
        ) : null}

        {savedSettings && (!canEdit || getError) ? (
          <dl className="mt-6 space-y-2 text-sm">
            <dt className="font-medium text-foreground">Zona horaria de la organización</dt>
            <dd className="break-words text-foreground-muted [overflow-wrap:anywhere]">{savedSettings.timezone}</dd>
          </dl>
        ) : null}
        {!canEdit ? <p className="mt-4 text-sm text-foreground-muted">Solo un administrador puede cambiar esta configuración.</p> : null}
      </Card>
      <p aria-live="polite" className="mt-4 text-sm text-success">{announcement}</p>
    </PageContainer>
  )
}

export function SettingsPage() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return <SettingsSessionPage canEdit={state.user.role === 'ADMIN'} key={`${state.user.organizationId}:${state.user.id}:${state.user.role}`} />
}
