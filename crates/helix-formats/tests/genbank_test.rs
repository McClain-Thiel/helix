use helix_core::sequence::Topology;
use helix_formats::genbank;

const PUC19_GB: &str = include_str!("fixtures/pUC19.gb");

#[test]
fn test_parse_puc19_basic_fields() {
    let seq = genbank::parse(PUC19_GB).unwrap();
    assert_eq!(seq.name, "pUC19");
    assert_eq!(seq.topology, Topology::Circular);
    assert_eq!(seq.len(), 2686);
}

#[test]
fn test_parse_puc19_features() {
    let seq = genbank::parse(PUC19_GB).unwrap();

    // Should have 7 features: source, lac promoter, AmpR, pMB1 ori, MCS, lac UV5, lacZ-alpha
    assert_eq!(seq.features.len(), 7);

    // Check AmpR feature
    let ampr = seq
        .features
        .iter()
        .find(|f| f.name == "AmpR")
        .expect("AmpR feature not found");
    assert_eq!(ampr.strand, helix_core::feature::Strand::Reverse);
    assert_eq!(ampr.start(), 1628); // 0-based
    assert_eq!(ampr.end(), 2489);
}

#[test]
fn test_parse_puc19_metadata() {
    let seq = genbank::parse(PUC19_GB).unwrap();
    assert_eq!(seq.metadata.accession.as_deref(), Some("L09137"));
    assert_eq!(seq.metadata.organism.as_deref(), Some("synthetic construct"));
    assert!(seq.metadata.references.len() >= 1);
}

#[test]
fn test_puc19_roundtrip() {
    let seq = genbank::parse(PUC19_GB).unwrap();
    let serialized = genbank::serialize(&seq);
    let reparsed = genbank::parse(&serialized).unwrap();

    assert_eq!(reparsed.name, seq.name);
    assert_eq!(reparsed.topology, seq.topology);
    assert_eq!(reparsed.sequence, seq.sequence);
    assert_eq!(reparsed.features.len(), seq.features.len());

    // Verify sequence content is preserved exactly
    assert_eq!(reparsed.len(), seq.len());
    assert_eq!(reparsed.sequence, seq.sequence);
}
