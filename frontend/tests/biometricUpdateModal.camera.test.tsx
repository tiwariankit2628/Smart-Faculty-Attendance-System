import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { useCamera } from '../hooks/useCamera';
import { BiometricUpdateModal } from '../components/faculty/BiometricUpdateModal';
import { facultyService } from '../services/faculty.service';

vi.mock('../services/faculty.service', () => ({
  facultyService: {
    submitBiometricUpdateRequest: vi.fn(),
    getBiometricUpdateRequests: vi.fn(),
  },
}));

describe('Camera Initialization & Biometric Photo Modal Regression Tests', () => {
  let mockTracks: any[];
  let mockStream: any;
  let originalMediaDevices: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTracks = [
      {
        stop: vi.fn(),
        kind: 'video',
        enabled: true,
      },
    ];

    mockStream = {
      active: true,
      getTracks: vi.fn(() => mockTracks),
      getVideoTracks: vi.fn(() => mockTracks),
    };

    originalMediaDevices = navigator.mediaDevices;

    // Define mock mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    // Mock HTMLMediaElement prototype methods
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    // Mock Canvas getContext and toBlob
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
      if (contextId === '2d') {
        return {
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          fillText: vi.fn(),
          createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          getImageData: vi.fn(() => ({
            // Return 64x48 sample of non-zero pixels (bright image)
            data: new Uint8ClampedArray(64 * 48 * 4).map((_, i) => (i % 4 === 3 ? 255 : 120)),
          })),
        };
      }
      return null;
    }) as any;

    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb) => {
      cb(new Blob(['fake-image-content'], { type: 'image/jpeg' }));
    });

    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/mock-preview');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: originalMediaDevices,
      });
    }
  });

  describe('useCamera Hook', () => {
    it('1. should initialize with default idle state', () => {
      const { result } = renderHook(() => useCamera());
      expect(result.current.cameraState.isActive).toBe(false);
      expect(result.current.cameraState.isLoading).toBe(false);
      expect(result.current.cameraState.isVideoReady).toBe(false);
      expect(result.current.cameraState.error).toBeNull();
    });

    it('2. should request camera access with ideal constraints and attach stream', async () => {
      const { result } = renderHook(() => useCamera());

      // Create a mock video element attached to videoRef
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'videoWidth', { value: 1280, writable: true });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 720, writable: true });
      result.current.videoRef.current = mockVideo;

      await act(async () => {
        await result.current.startCamera('user');
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      expect(mockVideo.srcObject).toBe(mockStream);
      expect(mockVideo.play).toHaveBeenCalled();
      expect(result.current.cameraState.isActive).toBe(true);
      expect(result.current.cameraState.isLoading).toBe(false);
      expect(result.current.cameraState.isVideoReady).toBe(true);
    });

    it('3. should handle OverconstrainedError by falling back to basic video constraint', async () => {
      const overconstrainedErr = new Error('Constraints not satisfied');
      overconstrainedErr.name = 'OverconstrainedError';

      const mockGetUserMedia = vi
        .fn()
        .mockRejectedValueOnce(overconstrainedErr)
        .mockResolvedValueOnce(mockStream);

      navigator.mediaDevices.getUserMedia = mockGetUserMedia;

      const { result } = renderHook(() => useCamera());
      const mockVideo = document.createElement('video');
      result.current.videoRef.current = mockVideo;

      await act(async () => {
        await result.current.startCamera('user');
      });

      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      expect(mockGetUserMedia).toHaveBeenLastCalledWith({
        video: { facingMode: 'user' },
        audio: false,
      });
      expect(result.current.cameraState.isActive).toBe(true);
    });

    it('4. should handle permission denied error appropriately', async () => {
      const notAllowedErr = new Error('Permission denied');
      notAllowedErr.name = 'NotAllowedError';
      navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValueOnce(notAllowedErr);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera('user');
      });

      expect(result.current.cameraState.isActive).toBe(false);
      expect(result.current.cameraState.hasPermission).toBe(false);
      expect(result.current.cameraState.error).toContain('Camera permission denied');
    });

    it('5. should handle device busy / NotReadableError', async () => {
      const busyErr = new Error('Device busy');
      busyErr.name = 'NotReadableError';
      navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValueOnce(busyErr);

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera('user');
      });

      expect(result.current.cameraState.isActive).toBe(false);
      expect(result.current.cameraState.error).toContain('in use by another application');
    });

    it('6. should reject capture if video has zero dimensions', async () => {
      const { result } = renderHook(() => useCamera());
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'videoWidth', { value: 0, writable: true });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 0, writable: true });
      result.current.videoRef.current = mockVideo;

      await act(async () => {
        await result.current.startCamera('user');
      });

      await expect(result.current.capturePhoto()).rejects.toThrow(
        /not ready for capture/i
      );
    });

    it('7. should reject capture if frame is entirely black', async () => {
      // Mock getImageData to return all zeros (pure pitch black)
      HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
        if (contextId === '2d') {
          return {
            drawImage: vi.fn(),
            getImageData: vi.fn(() => ({
              data: new Uint8ClampedArray(64 * 48 * 4).fill(0), // all black
            })),
          };
        }
        return null;
      }) as any;

      const { result } = renderHook(() => useCamera());
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'videoWidth', { value: 640, writable: true });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 480, writable: true });
      result.current.videoRef.current = mockVideo;

      await act(async () => {
        await result.current.startCamera('user');
      });

      await expect(result.current.capturePhoto()).rejects.toThrow(
        /completely black/i
      );
    });

    it('8. should successfully capture a valid non-black frame and return previewUrl', async () => {
      const { result } = renderHook(() => useCamera());
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'videoWidth', { value: 640, writable: true });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 480, writable: true });
      result.current.videoRef.current = mockVideo;

      await act(async () => {
        await result.current.startCamera('user');
      });

      const photo = await result.current.capturePhoto();
      expect(photo.blob).toBeDefined();
      expect(photo.previewUrl).toBe('blob:http://localhost:3000/mock-preview');
    });

    it('9. should stop all stream tracks on stopStream', async () => {
      const { result } = renderHook(() => useCamera());
      const mockVideo = document.createElement('video');
      result.current.videoRef.current = mockVideo;

      await act(async () => {
        await result.current.startCamera('user');
      });

      act(() => {
        result.current.stopStream();
      });

      expect(mockTracks[0].stop).toHaveBeenCalled();
      expect(mockVideo.srcObject).toBeNull();
      expect(result.current.cameraState.isActive).toBe(false);
      expect(result.current.cameraState.isVideoReady).toBe(false);
    });
  });

  describe('BiometricUpdateModal Component', () => {
    it('10. should render modal and switch to camera mode with persistent video element', async () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      render(
        <BiometricUpdateModal
          isOpen={true}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      );

      expect(screen.getByText('Update Biometric Profile Photo')).toBeTruthy();

      // Click "Take Photo" tab
      const takePhotoBtn = screen.getByText('Take Photo');
      await act(async () => {
        fireEvent.click(takePhotoBtn);
      });

      // Video element should be mounted in the DOM
      const videoElement = document.querySelector('video');
      expect(videoElement).toBeTruthy();
      expect(videoElement?.hasAttribute('autoplay')).toBe(true);
      expect(videoElement?.hasAttribute('playsinline')).toBe(true);
    });

    it('11. should display error overlay and Retry Camera button when camera fails', async () => {
      const busyErr = new Error('Device busy');
      busyErr.name = 'NotReadableError';
      navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValueOnce(busyErr);

      render(
        <BiometricUpdateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const takePhotoBtn = screen.getByText('Take Photo');
      await act(async () => {
        fireEvent.click(takePhotoBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/in use by another application/i)).toBeTruthy();
        expect(screen.getByText('Retry Camera')).toBeTruthy();
      });

      // Video element remains in DOM despite error
      expect(document.querySelector('video')).toBeTruthy();

      // Retry camera
      navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValueOnce(mockStream);
      const retryBtn = screen.getByText('Retry Camera');
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText(/in use by another application/i)).toBeNull();
      });
    });

    it('12. should cleanly stop camera stream when modal is closed', async () => {
      const handleClose = vi.fn();

      const { rerender } = render(
        <BiometricUpdateModal
          isOpen={true}
          onClose={handleClose}
          onSuccess={vi.fn()}
        />
      );

      // Start camera
      const takePhotoBtn = screen.getByText('Take Photo');
      await act(async () => {
        fireEvent.click(takePhotoBtn);
      });

      // Close modal
      const closeBtn = screen.getByTitle('Close');
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      expect(handleClose).toHaveBeenCalled();
      expect(mockTracks[0].stop).toHaveBeenCalled();

      // Rerender as closed
      rerender(
        <BiometricUpdateModal
          isOpen={false}
          onClose={handleClose}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.queryByText('Update Biometric Profile Photo')).toBeNull();
    });
  });
});
