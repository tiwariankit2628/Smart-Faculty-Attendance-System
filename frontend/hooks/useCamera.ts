'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface CameraState {
  isActive: boolean;
  isLoading: boolean;
  isVideoReady: boolean;
  hasPermission: boolean | null;
  error: string | null;
  facingMode: 'user' | 'environment';
  videoWidth: number;
  videoHeight: number;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>({
    isActive: false,
    isLoading: false,
    isVideoReady: false,
    hasPermission: null,
    error: null,
    facingMode: 'user',
    videoWidth: 0,
    videoHeight: 0,
  });

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState((prev) => ({
      ...prev,
      isActive: false,
      isLoading: false,
      isVideoReady: false,
      videoWidth: 0,
      videoHeight: 0,
    }));
  }, []);

  const updateVideoReadiness = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setCameraState((prev) => {
        if (
          prev.isVideoReady &&
          prev.videoWidth === video.videoWidth &&
          prev.videoHeight === video.videoHeight
        ) {
          return prev;
        }
        return {
          ...prev,
          isVideoReady: true,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        };
      });
    }
  }, []);

  // Synchronize stream to video element whenever videoRef or stream becomes active
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (cameraState.isActive && video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      if (video.paused) {
        video.play().catch(() => {});
      }
      if (video.videoWidth > 0 && video.videoHeight > 0 && !cameraState.isVideoReady) {
        updateVideoReadiness();
      }
    }
  });

  // Attach event listeners to monitor when video frames start rendering
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onReady = () => updateVideoReadiness();

    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', onReady);
    video.addEventListener('resize', onReady);

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      updateVideoReadiness();
    }

    return () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('resize', onReady);
    };
  }, [cameraState.isActive, updateVideoReadiness]);

  const startCamera = useCallback(
    async (facing: 'user' | 'environment' = 'user') => {
      stopStream();
      setCameraState((prev) => ({
        ...prev,
        isLoading: true,
        isVideoReady: false,
        error: null,
        facingMode: facing,
        videoWidth: 0,
        videoHeight: 0,
      }));

      try {
        // Secure context check (camera requires HTTPS or localhost)
        if (
          typeof window !== 'undefined' &&
          window.isSecureContext === false &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1'
        ) {
          throw new Error('Camera access requires a secure context (HTTPS or localhost).');
        }

        // In development / automated testing without physical camera hardware, use mock canvas stream
        if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
          const mockCanvas = document.createElement('canvas');
          mockCanvas.width = 640;
          mockCanvas.height = 480;
          const ctx = mockCanvas.getContext('2d');
          if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 640, 480);
            grad.addColorStop(0, '#1e293b');
            grad.addColorStop(1, '#3b82f6');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(320, 220, 90, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ACTIVE WEBCAM FEED', 320, 360);
          }
          if ((mockCanvas as any).captureStream) {
            const mockStream = (mockCanvas as any).captureStream(15);
            streamRef.current = mockStream;
            if (videoRef.current) {
              videoRef.current.srcObject = mockStream;
              await videoRef.current.play().catch(() => {});
            }
            setCameraState({
              isActive: true,
              isLoading: false,
              isVideoReady: true,
              hasPermission: true,
              error: null,
              facingMode: facing,
              videoWidth: 640,
              videoHeight: 480,
            });
            return;
          }
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported by this browser or environment.');
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          });
        } catch (initialErr: any) {
          // If ideal constraints fail (e.g. OverconstrainedError), fallback to basic video constraint
          if (
            initialErr?.name === 'OverconstrainedError' ||
            initialErr?.name === 'ConstraintNotSatisfiedError'
          ) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facing },
              audio: false,
            });
          } else {
            throw initialErr;
          }
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {
            // Auto-play policy handled
          });
        }

        const isReady =
          (videoRef.current?.videoWidth ?? 0) > 0 && (videoRef.current?.videoHeight ?? 0) > 0;

        setCameraState({
          isActive: true,
          isLoading: false,
          isVideoReady: isReady,
          hasPermission: true,
          error: null,
          facingMode: facing,
          videoWidth: videoRef.current?.videoWidth ?? 0,
          videoHeight: videoRef.current?.videoHeight ?? 0,
        });
      } catch (err: unknown) {
        stopStream();
        let message = 'Unable to access camera.';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            message =
              'Camera permission denied. Please allow camera access in your browser settings to capture your photo.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            message = 'No camera found on this device. Please connect a webcam.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            message =
              'Camera is currently in use by another application or tab. Please close other camera apps and retry.';
          } else if (err.name === 'OverconstrainedError') {
            message = 'Requested camera resolution is unsupported by your hardware.';
          } else if (err.name === 'SecurityError') {
            message = 'Camera access blocked due to security restrictions (requires HTTPS or localhost).';
          } else {
            message = err.message || message;
          }
        }

        setCameraState({
          isActive: false,
          isLoading: false,
          isVideoReady: false,
          hasPermission: false,
          error: message,
          facingMode: facing,
          videoWidth: 0,
          videoHeight: 0,
        });
      }
    },
    [stopStream]
  );

  const capturePhoto = useCallback((): Promise<{ blob: Blob; previewUrl: string }> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video) {
        return reject(new Error('Camera video element is not available for capture.'));
      }
      if (!streamRef.current || !streamRef.current.active) {
        return reject(new Error('Camera stream is not active.'));
      }
      const width = video.videoWidth || (video as any).width || 0;
      const height = video.videoHeight || (video as any).height || 0;

      if (width === 0 || height === 0) {
        return reject(
          new Error('Camera video stream is not ready for capture. Please wait for camera feed.')
        );
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Failed to create canvas rendering context.'));
      }

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, width, height);

      // Validate frame is not completely blank or black
      try {
        const sampleCanvas = document.createElement('canvas');
        const sampleW = Math.min(width, 64);
        const sampleH = Math.min(height, 48);
        sampleCanvas.width = sampleW;
        sampleCanvas.height = sampleH;
        const sCtx = sampleCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
          const imgData = sCtx.getImageData(0, 0, sampleW, sampleH).data;
          let visiblePixels = 0;
          const totalPixels = sampleW * sampleH;
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (a > 0 && lum > 8) {
              visiblePixels++;
            }
          }

          // If fewer than 2% of pixels are non-black (e.g. pitch black screen / covered lens)
          if (visiblePixels < totalPixels * 0.02) {
            return reject(
              new Error(
                'Captured image is completely black. Please ensure your camera lens is uncovered, has adequate lighting, and live preview is displaying.'
              )
            );
          }
        }
      } catch {
        // Safe fallback if getImageData is restricted
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Failed to encode camera frame into image.'));
          }
          const previewUrl = URL.createObjectURL(blob);
          resolve({ blob, previewUrl });
        },
        'image/jpeg',
        0.92
      );
    });
  }, []);

  const captureFrameSequence = useCallback(
    async (
      count: number = 10,
      intervalMs: number = 450,
      onProgress?: (capturedCount: number, remainingSeconds: number) => void
    ): Promise<{ primaryBlob: Blob; primaryPreviewUrl: string; frameBlobs: Blob[] }> => {
      const video = videoRef.current;
      if (!video) {
        throw new Error('Camera video stream is not ready for capture.');
      }
      const width = video.videoWidth || (video as any).width || 0;
      const height = video.videoHeight || (video as any).height || 0;

      if (width === 0 || height === 0) {
        throw new Error('Camera video stream has no active frame dimensions.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas rendering context.');

      const captureSingleBlob = (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          ctx.drawImage(video, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to capture frame.'));
            },
            'image/jpeg',
            0.90
          );
        });
      };

      const frameBlobs: Blob[] = [];
      const totalEstimatedMs = count * intervalMs;

      for (let i = 0; i < count; i++) {
        const b = await captureSingleBlob();
        frameBlobs.push(b);

        const msRemaining = Math.max(0, totalEstimatedMs - (i + 1) * intervalMs);
        const remainingSeconds = Math.max(1, Math.ceil(msRemaining / 1000));
        if (onProgress) {
          onProgress(i + 1, remainingSeconds);
        }

        if (i < count - 1) {
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }

      const primaryBlob = frameBlobs[0];
      const primaryPreviewUrl = URL.createObjectURL(primaryBlob);
      return { primaryBlob, primaryPreviewUrl, frameBlobs };
    },
    []
  );

  // Cleanup stream on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    cameraState,
    startCamera,
    stopCamera: stopStream,
    stopStream,
    capturePhoto,
    captureFrameSequence,
    updateVideoReadiness,
  };
}
