import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function DataImport() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setError('Nur Excel-Dateien (.xlsx, .xls) werden unterstützt');
        return;
      }
      setFile(selectedFile);
      setSuccess(false);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/import/excel`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const raw = await response.text();
        let message = `Upload failed (${response.status} ${response.statusText})`;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.error) message = parsed.error;
            else if (parsed?.message) message = parsed.message;
          } catch {
            message = raw;
          }
        }
        throw new Error(message);
      }

      setSuccess(true);
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById('excel-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Daten Import</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-md font-semibold text-blue-900 mb-2">📋 CSV Dateiformat</h3>
        <p className="text-sm text-blue-800 mb-4">
          Die CSV-Datei muss folgende Abschnitte enthalten:
        </p>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li><strong>Zimmertyp</strong> - Definition der Zimmertypen (DZ/DU, EZ/DU, APP, etc.)</li>
          <li><strong>Hotel</strong> - Hotels mit Zimmerkontingenten und Zeiträumen</li>
          <li><strong>Disziplin</strong> - Events mit Bedarf an Zimmern</li>
          <li><strong>athlets</strong> - Athleten und Staff-Mitglieder</li>
          <li><strong>roomlist</strong> - Zimmerzuteilungen</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Excel Datei hochladen</h3>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          {!file ? (
            <label htmlFor="excel-file-input" className="cursor-pointer">
              <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Excel Datei auswählen oder hierher ziehen
              </p>
              <p className="text-sm text-gray-500">
                Unterstützte Formate: .xlsx, .xls
              </p>
            </label>
          ) : (
            <div className="space-y-4">
              <FileText className="w-16 h-16 mx-auto text-blue-600" />
              <div>
                <p className="text-lg font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Importiere...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Importieren
                    </>
                  )}
                </button>

                <label
                  htmlFor="excel-file-input"
                  className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer transition-colors"
                >
                  Andere Datei wählen
                </label>
              </div>
            </div>
          )}
        </div>

        {success && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Import erfolgreich!</p>
              <p className="text-sm text-green-700">Die Daten wurden importiert. Seite wird neu geladen...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Import fehlgeschlagen</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Wichtiger Hinweis</h4>
        <p className="text-sm text-yellow-800">
          Der Import überschreibt nur die <strong>Athleten</strong> und <strong>Zimmerzuteilungen</strong>.
          Zimmertypen, Hotels und Events bleiben unverändert und müssen über das UI verwaltet werden.
        </p>
      </div>
    </div>
  );
}
