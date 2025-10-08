import { Component, NgZone } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AlertController, NavController, NavParams, ViewController } from 'ionic-angular';
import { Config } from '../../config';
import { SettingsModel } from '../../models/settings.model';
import { ElectronProvider } from '../../providers/electron/electron';
import { UtilsProvider } from '../../providers/utils/utils';
import { HttpClient } from '@angular/common/http';
import { TelemetryService } from '../../providers/telemetry/telemetry';
import { UpdateCheckerService } from '../../providers/update-checker/update-checker';

/**
 * Generated class for the InfoPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@Component({
  selector: 'page-info',
  templateUrl: 'info.html',
})
export class InfoPage {
  // the same variable can be found in the update.handler.ts of the main process
  public updateStatus: ('checkingForUpdate' | 'updateAvailable' | 'updateNotAvailable' |
    'updateError') = 'updateNotAvailable';
  public settings: SettingsModel; // required for the toggle ngModel to work
  public newVersion: string;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    public viewCtrl: ViewController,
    public electronProvider: ElectronProvider,
    public ngZone: NgZone,
    public utils: UtilsProvider,
    private translateService: TranslateService,
    private http: HttpClient,
    private alertController: AlertController,
    private telemetryProvider: TelemetryService,
    private updateCheckerService: UpdateCheckerService
  ) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad InfoPage');
    this.settings = this.electronProvider.store.get(Config.STORAGE_SETTINGS, new SettingsModel(UtilsProvider.GetOS()));

    // the main process communicates the status of the update to the renderer process
    this.electronProvider.ipcRenderer.on('onUpdateStatusChange', (e, updateStatus) => {
      this.ngZone.run(() => {
        this.updateStatus = updateStatus;
      })
    });

    // autoUpdater.checkUpdates() is always called on app start by the main
    // process in UpdateHandler/constructor/onSettingsChanged
    // Now i tell the main process to call it once again to check
    // to perform an update check when the Info page is opened.
    this.electronProvider.ipcRenderer.send('checkForUpdates');
    this.telemetryProvider.sendEvent('page_info', null, null);
  }

  // ion-toggle event
  onAutoUpdateChange(event) {
    this.electronProvider.store.set(Config.STORAGE_SETTINGS, this.settings);
    // notify the main process that the settings changed
    if (ElectronProvider.isElectron()) {
      this.electronProvider.ipcRenderer.send('settings');
    }
  }

  close() {
    this.viewCtrl.dismiss();
  }

  // Duplicated in telemetry.ts
  getVersion() {
    if (this.electronProvider.isDev()) {
      return '(DEV MODE)'
    } else if (ElectronProvider.isElectron()) {
      return this.electronProvider.appGetVersion();
    } else {
      return '(BROWSER MODE)'
    }
  }

  getWebSiteUrl() {
    return Config.URL_WEBSITE;
  }

  getWebSiteName() {
    return Config.WEBSITE_NAME;
  }

  getGitHubServer() {
    return Config.URL_GITHUB_SERVER;
  }

  getGitHubApp() {
    return Config.URL_GITHUB_APP;
  }

  getMailUrl() {
    return 'mailto:' + Config.EMAIL_SUPPORT;
  }

  getMail() {
    return Config.EMAIL_SUPPORT;
  }

  getAppName() {
    return Config.APP_NAME;
  }

  // Methods to "translate" the status received from the MAIN process to the user interface
  getUpdateStatus() {
    if (this.updateStatus == 'checkingForUpdate') return this.translateService.instant('checkingForUpdates');
    if (this.updateStatus == 'updateAvailable') return this.translateService.instant('outOfDate', {
      "appName": Config.APP_NAME,
    })
    if (this.updateStatus == 'updateNotAvailable') return this.translateService.instant('upToDate', {
      "appName": Config.APP_NAME,
    })
    if (this.updateStatus == 'updateError') return this.translateService.instant('updateError');
    if (this.updateStatus == 'updateDownloaded') return this.translateService.instant('readyForUpdate', {
      "appName": Config.APP_NAME,
    });
  }

  getUpdateIcon() {
    // if (this.updateStatus == 'checkingForUpdate') return ''; // updating => spinner
    if (this.updateStatus == 'updateAvailable') return 'refresh-circle';
    if (this.updateStatus == 'updateNotAvailable') return 'checkmark-circle';
    if (this.updateStatus == 'updateError') return 'close-circle';
  }

  getLastUpdateCheck() {
    return this.updateCheckerService.getLastUpdateCheck();
  }

  async checkForUpdates() {
    const currentVersion = this.getVersion();

    this.updateStatus = 'checkingForUpdate';

    try {
      const result = await this.updateCheckerService.checkForUpdates(currentVersion, false);

      if (result.hasUpdate) {
        this.newVersion = result.latestVersion;
        this.updateStatus = 'updateAvailable';

        this.alertController.create({
          title: this.translateService.instant('update'),
          message: this.translateService.instant('updateAvailable'),
          buttons: [{
            text: this.translateService.instant('cancel'), role: 'cancel'
          }, {
            text: this.translateService.instant('download'), handler: () => {
              this.electronProvider.shell.openExternal(Config.URL_DOWNLOAD_SERVER);
            }
          }]
        }).present();
      } else {
        this.updateStatus = 'updateNotAvailable';
        this.alertController.create({
          title: 'No Updates',
          message: this.translateService.instant('youAreUsingLatestVersion'),
          buttons: [await this.utils.text('ok')]
        }).present();
      }
    } catch (error) {
      this.updateStatus = 'updateError';
      this.alertController.create({
        title: 'Error',
        message: this.translateService.instant('couldNotCheckForUpdates'),
        buttons: [await this.utils.text('ok')]
      }).present();
    }
  }

  getUpdateButtonText() {
    if (this.updateStatus == 'checkingForUpdate') return this.translateService.instant('update'); // disabled
    if (this.updateStatus == 'updateAvailable') return this.translateService.instant('update');
    if (this.updateStatus == 'updateNotAvailable') return this.translateService.instant('update');
    if (this.updateStatus == 'updateError') return this.translateService.instant('update');
  }

}
