/**
 * Provider-neutral GST verification boundary.
 *
 * A provider adapter can be added without exposing provider credentials to the
 * browser. Until GST_VERIFICATION_PROVIDER is configured with an implementation,
 * every registration stays in manual_review and cannot publish jobs.
 */
async function verifyGstin({ gstin, organizationName, registeredAddress }) {
  if (!process.env.GST_VERIFICATION_PROVIDER) {
    return {
      status: 'manual_review',
      provider: null,
      reference: null,
      result: {
        reason: 'provider_not_configured',
        submittedGstin: gstin,
        submittedOrganizationName: organizationName,
        submittedRegisteredAddress: registeredAddress
      }
    };
  }

  // Provider adapters should be registered here once a provider is selected.
  // Fail closed: an unknown provider must never mark an organization verified.
  return {
    status: 'manual_review',
    provider: process.env.GST_VERIFICATION_PROVIDER,
    reference: null,
    result: { reason: 'provider_adapter_not_implemented' }
  };
}

module.exports = { verifyGstin };
