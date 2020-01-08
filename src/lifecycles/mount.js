import { NOT_MOUNTED, MOUNTED, SKIP_BECAUSE_BROKEN } from '../applications/app.helpers.js';
import { handleAppError, transformErr } from '../applications/app-errors.js';
import { reasonableTime } from '../applications/timeouts.js';
import CustomEvent from 'custom-event';
import { getProps } from './prop.helpers.js';
import { toUnmountPromise } from './unmount.js';

let beforeFirstMountFired = false;
let firstMountFired = false;

export function toMountPromise(appOrParcel, hardFail = false) {
  return Promise.resolve().then(() => {
    if (appOrParcel.status !== NOT_MOUNTED) {
      return appOrParcel;
    }

    if (!beforeFirstMountFired) {
      window.dispatchEvent(new CustomEvent('single-spa:before-first-mount'));
      beforeFirstMountFired = true;
    }

    // gongdf - 调用子应用定义的mount方法 append元素到指定地方
    return reasonableTime(appOrParcel.mount(getProps(appOrParcel)), `Mounting application '${appOrParcel.name}'`, appOrParcel.timeouts.mount)
      .then(() => {
        // gongdf - 标识状态为MOUNTED
        appOrParcel.status = MOUNTED;

        if (!firstMountFired) {
          window.dispatchEvent(new CustomEvent('single-spa:first-mount'));
          firstMountFired = true;
        }

        return appOrParcel;
      })
      .catch(err => {
        // If we fail to mount the appOrParcel, we should attempt to unmount it before putting in SKIP_BECAUSE_BROKEN
        // We temporarily put the appOrParcel into MOUNTED status so that toUnmountPromise actually attempts to unmount it
        // instead of just doing a no-op.
        appOrParcel.status = MOUNTED
        return toUnmountPromise(appOrParcel)
          .then(setSkipBecauseBroken, setSkipBecauseBroken)

        function setSkipBecauseBroken() {
          if (!hardFail) {
            handleAppError(err, appOrParcel);
            appOrParcel.status = SKIP_BECAUSE_BROKEN;
            return appOrParcel;
          } else {
            const transformedErr = transformErr(err, appOrParcel)
            appOrParcel.status = SKIP_BECAUSE_BROKEN;
            throw transformedErr
          }
        }
      })
  })
}
