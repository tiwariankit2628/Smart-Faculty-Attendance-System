'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { adminService } from '../../../services/admin.service';
import { Geofence } from '../../../types';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { GeofenceConfigurator } from '../../../components/admin/GeofenceConfigurator';
import { Button } from '../../../components/ui/Button';

export default function AttendanceZonePage() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGeofences = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getGeofences();
      setGeofences(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGeofences();
  }, []);

  const handleSave = async (id: string, updates: Partial<Geofence>) => {
    await adminService.updateGeofence(id, updates);
    await loadGeofences();
  };

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Attendance Zone Configuration"
        subtitle="Define physical campus geofences, perimeter radii, and GPS accuracy tolerances"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={loadGeofences}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="text-xs"
          >
            Reload Zones
          </Button>
        }
      />

      <div className="p-6">
        {geofences.length > 0 && (
          <GeofenceConfigurator geofences={geofences} onSave={handleSave} />
        )}
      </div>
    </div>
  );
}
