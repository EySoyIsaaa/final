/**
 * useNotificationPermission - Solicita permiso de notificaciones en Android 13+
 * 
 * En Android 13 (API 33+), las notificaciones requieren permiso explícito del usuario.
 * Este hook solicita el permiso una vez al montar la app.
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export function useNotificationPermission() {
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'pending'>('pending');

  useEffect(() => {
    const requestPermission = async () => {
      // Solo en plataforma nativa Android
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        setPermissionStatus('granted');
        return;
      }

      try {
        // Usar la API estándar de Notification del navegador
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          setPermissionStatus(permission === 'granted' ? 'granted' : 'denied');
          console.log('[NotificationPermission] Status:', permission);
        } else {
          // Si no hay API de Notification, asumimos granted (versiones antiguas)
          console.log('[NotificationPermission] Notification API not available, assuming granted');
          setPermissionStatus('granted');
        }
      } catch (error) {
        console.error('[NotificationPermission] Error requesting permission:', error);
        // En caso de error, asumimos granted para no bloquear la funcionalidad
        setPermissionStatus('granted');
      }
    };

    requestPermission();
  }, []);

  return permissionStatus;
}

export default useNotificationPermission;
