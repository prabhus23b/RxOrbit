import React, { useState } from 'react';
import { Award, CheckCircle2, Download, Search, XCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { normalizeCertificateCode } from '../lib/domain';
import type { Certificate } from '../types';

export function VerifyCertificatePage() {
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeCertificateCode(codeInput);
    if (!cleaned) {
      setErrorMsg('Please enter a Certificate ID.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setCertificate(null);
    try {
      const res = await apiRequest<{ certificate: Certificate }>(
        `/api/certificates/verify/${encodeURIComponent(cleaned)}`
      );
      setCertificate(res.certificate);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No matching certificate found.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Credential Registry
        </p>
        <h1 className="text-3xl font-display font-bold text-[#0F2442]">
          Verify an RxOrbit Certificate
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
          Enter the unique Certificate ID printed on any RxOrbit academic workshop, seminar, or
          conference certificate to confirm authenticity and download the official PDF.
        </p>
      </div>

      <form
        onSubmit={handleVerify}
        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <label htmlFor="verify-cert-id" className="sr-only">
            Certificate ID
          </label>
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="verify-cert-id"
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Enter Certificate ID"
            className="w-full pl-10 pr-4 py-2.5 text-sm font-mono uppercase border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0F2442] hover:bg-slate-800 disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loading ? 'Verifying...' : 'Verify Certificate'}
        </button>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3"
        >
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-red-900">Verification Failed</div>
            <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {certificate && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-teal-50 border-b border-teal-200 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-teal-700" />
              <span className="font-semibold text-sm text-[#0F2442]">
                Verified Authentic Credential
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-teal-800">
              {certificate.certificateCode}
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">{certificate.templateTitle}</p>
                <h2 className="text-2xl font-display font-bold text-[#0F2442] mt-1">
                  {certificate.participantName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{certificate.participantEmail}</p>
              </div>
              <Award className="h-9 w-9 text-teal-700 shrink-0" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
              <div>
                <div className="text-xs text-slate-500">Event / Program</div>
                <div className="font-semibold text-[#0F2442] mt-0.5">{certificate.eventName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Event Date</div>
                <div className="font-mono font-medium text-[#0F2442] mt-0.5 tabular-nums">
                  {certificate.eventDate}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Issuing Organization</div>
                <div className="font-medium text-[#0F2442] mt-0.5">
                  {certificate.organizationName}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Authorized Signatory</div>
                <div className="font-medium text-[#0F2442] mt-0.5">
                  {certificate.signatoryName || 'Authorized Signatory'}
                  {certificate.signatoryRole ? ` (${certificate.signatoryRole})` : ''}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <a
                href={`/api/certificates/${encodeURIComponent(certificate.certificateCode)}/pdf`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Official PDF</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
