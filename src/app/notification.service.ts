import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, timeout, retry } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly VAPID_PUBLIC_KEY = 'BJUGueezdQ1fUnOWNvNGpYtCHQIr2kZpxQHxm0IVD_bW6vzxfplaL7GKcSQYB8EE_JZ_fHjJpuOsGDOBGrMlkG4';
  private readonly API_URL = 'http://localhost:5281/api/notifications';
  private platformId = inject(PLATFORM_ID);
  private currentSubscription: PushSubscription | null = null;

  constructor(
    private swPush: SwPush,
    private http: HttpClient
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.checkServiceWorker();
      this.setupPushNotificationHandling();
    }
  }

  private setupPushNotificationHandling() {
    this.swPush.messages.subscribe(message => {
      console.log('Received push message:', message);
    });

    this.swPush.notificationClicks.subscribe(({ action, notification }) => {
      console.log('Notification clicked:', { action, notification });
    });
  }

  private async checkServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        console.log('Service Worker registration:', registration);
        
        if (registration) {
          console.log('Service Worker state:', registration.active ? 'active' : 'inactive');
          console.log('Push Manager:', 'pushManager' in registration ? 'available' : 'not available');
          
          // Check if already subscribed
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            this.currentSubscription = subscription;
          }
          console.log('Existing push subscription:', subscription);
        } else {
          console.log('No Service Worker registration found');
        }
      } catch (error) {
        console.error('Service Worker check error:', error);
      }
    } else {
      console.log('Service Workers not supported');
    }
  }

  async subscribeToNotifications() {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Push notifications are only available in browser environment');
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('Service Worker not registered');
      }

      // First, unsubscribe from any existing subscriptions
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // Request a new subscription
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY
      });

      console.log('New Push Subscription:', subscription);
      this.currentSubscription = subscription;
      
      // Send subscription to server with retry logic
      const response = await firstValueFrom(
        this.http.post(
          `${this.API_URL}/subscribe`,
          subscription.toJSON(),
          {
            headers: new HttpHeaders({
              'Content-Type': 'application/json'
            })
          }
        ).pipe(
          timeout(5000), // 5 second timeout
          retry(3) // Retry 3 times
        )
      );
      
      console.log('Server response:', response);
      return response;
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      throw error;
    }
  }

  async sendTestNotification() {
    if (!this.currentSubscription) {
      throw new Error('No active push subscription found. Please subscribe first.');
    }

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.API_URL}/send`,
          this.currentSubscription.toJSON(),
          {
            headers: new HttpHeaders({
              'Content-Type': 'application/json'
            })
          }
        ).pipe(
          timeout(5000),
          retry(3)
        )
      );

      console.log('Test notification sent:', response);
      return response;
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }
}
