import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { NotificationService } from './notification.service';
import { isPlatformBrowser } from '@angular/common';
import { BluetoothAccessComponent } from './bluetoothaccess/bluetoothaccess.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, BluetoothAccessComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private swPush = inject(SwPush);

  isPushAvailable = false;
  isSubscribed = false;
  buttonText = 'Subscribe to Notifications';
  errorMessage = '';
  subscriptionStatus: { message: string, type: 'success' | 'error' } | null = null;
  debugInfo: any = null;

  constructor(private notificationService: NotificationService) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkPushAvailability();
    } else {
      this.errorMessage = 'Push notifications are only available in browser environment';
      this.debugInfo = { error: 'Not a browser environment' };
    }
  }

  private async checkPushAvailability() {
    this.debugInfo = {
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window,
      swPushEnabled: this.swPush.isEnabled,
      environment: {
        protocol: window.location.protocol,
        host: window.location.host,
        pathname: window.location.pathname
      }
    };

    if (!('serviceWorker' in navigator)) {
      this.errorMessage = 'Service Worker is not supported in this browser';
      return;
    }

    if (!('PushManager' in window)) {
      this.errorMessage = 'Push notifications are not supported in this browser';
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      this.debugInfo.registration = registration ? 'Found' : 'Not found';
      this.debugInfo.registrationScope = registration?.scope;

      if (!registration) {
        this.errorMessage = 'Service Worker is not registered. Please reload the page.';
        try {
          // Try registering manually with the correct path
          const swPath = '/ngsw-worker.js';
          const newRegistration = await navigator.serviceWorker.register(swPath, {
            scope: '/'
          });
          this.debugInfo.manualRegistration = 'Successful';
          this.debugInfo.manualRegistrationScope = newRegistration.scope;
          this.debugInfo.registeredServiceWorker = swPath;

          // Use the new registration for subscription check
          const subscription = await newRegistration.pushManager.getSubscription();
          this.updateSubscriptionState(subscription);
          this.isPushAvailable = true;
        } catch (regError) {
          this.debugInfo.manualRegistrationError = regError instanceof Error ? regError.message : 'Unknown error';
          return;
        }
      } else {
        const subscription = await registration.pushManager.getSubscription();
        this.updateSubscriptionState(subscription);
        this.isPushAvailable = true;
      }
    } catch (error) {
      console.error('Error checking service worker registration:', error);
      this.errorMessage = 'Error checking service worker registration. Please reload the page.';
      this.debugInfo.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private updateSubscriptionState(subscription: PushSubscription | null) {
    this.isSubscribed = !!subscription;
    if (subscription) {
      this.buttonText = 'Update Notification Subscription';
      this.debugInfo.existingSubscription = 'Found';
      this.debugInfo.subscriptionEndpoint = subscription.endpoint;
    } else {
      this.buttonText = 'Subscribe to Notifications';
      this.debugInfo.existingSubscription = 'None';
    }
  }

  async subscribeToNotifications() {
    try {
      await this.notificationService.subscribeToNotifications();
      this.subscriptionStatus = {
        message: 'Successfully subscribed to notifications!',
        type: 'success'
      };
      this.buttonText = 'Update Notification Subscription';
      this.isSubscribed = true;
    } catch (err) {
      console.error('Subscription error:', err);
      this.subscriptionStatus = {
        message: 'Failed to subscribe to notifications. ' + (err instanceof Error ? err.message : ''),
        type: 'error'
      };
    }
  }

  async sendTestNotification() {
    try {
      await this.notificationService.sendTestNotification();
      this.subscriptionStatus = {
        message: 'Test notification sent successfully!',
        type: 'success'
      };
    } catch (err) {
      console.error('Error sending test notification:', err);
      this.subscriptionStatus = {
        message: 'Failed to send test notification. ' + (err instanceof Error ? err.message : ''),
        type: 'error'
      };
    }
  }
}

