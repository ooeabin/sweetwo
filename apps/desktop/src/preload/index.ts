import { contextBridge } from 'electron';

// 렌더러에 노출하는 것은 window.sweetwo 하나. 채널을 늘릴 때는 main/ipc/에 파일 하나씩.
contextBridge.exposeInMainWorld('sweetwo', { version: process.versions.electron });
