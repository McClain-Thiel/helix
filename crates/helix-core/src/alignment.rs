use crate::operations::reverse_complement;

/// Scoring parameters for Smith-Waterman alignment with affine gap penalties.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScoringParams {
    /// Score awarded for a matching base pair.
    pub match_score: i32,
    /// Penalty for a mismatching base pair (should be negative).
    pub mismatch_score: i32,
    /// Penalty for opening a new gap (should be negative).
    pub gap_open: i32,
    /// Penalty for extending an existing gap (should be negative).
    pub gap_extend: i32,
}

impl Default for ScoringParams {
    fn default() -> Self {
        Self {
            match_score: 2,
            mismatch_score: -3,
            gap_open: -5,
            gap_extend: -2,
        }
    }
}

/// Result of a Smith-Waterman local alignment.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AlignmentResult {
    /// Alignment score.
    pub score: i32,
    /// Start position in the target (0-based, inclusive).
    pub target_start: usize,
    /// End position in the target (0-based, exclusive).
    pub target_end: usize,
    /// Start position in the query (0-based, inclusive).
    pub query_start: usize,
    /// End position in the query (0-based, exclusive).
    pub query_end: usize,
    /// Number of matching positions in the alignment.
    pub matches: usize,
    /// Number of mismatching positions in the alignment.
    pub mismatches: usize,
    /// Number of gap positions in the alignment.
    pub gaps: usize,
    /// Total alignment length (matches + mismatches + gaps).
    pub alignment_length: usize,
}

impl AlignmentResult {
    /// Percent identity: fraction of aligned columns that are matches.
    pub fn percent_identity(&self) -> f64 {
        if self.alignment_length == 0 {
            return 0.0;
        }
        self.matches as f64 / self.alignment_length as f64 * 100.0
    }

    /// Query coverage: fraction of the query consumed by the alignment.
    pub fn query_coverage(&self, query_len: usize) -> f64 {
        if query_len == 0 {
            return 0.0;
        }
        (self.query_end - self.query_start) as f64 / query_len as f64 * 100.0
    }
}

/// Traceback direction stored per cell.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TraceOp {
    /// No predecessor (alignment starts here or cell is zero).
    None,
    /// Came from a match/mismatch (diagonal move).
    Match,
    /// Came from a gap in the query (vertical move, consuming target).
    GapInQuery,
    /// Came from a gap in the target (horizontal move, consuming query).
    GapInTarget,
}

/// Perform banded Smith-Waterman local alignment with affine gap penalties.
///
/// `query` is the known sequence (e.g. a primer or probe). `target` is the
/// sequence being searched. The algorithm finds the highest-scoring local
/// alignment between the two.
///
/// When `band_width` is `Some(w)`, only cells within `w` diagonals of the
/// main diagonal are computed, which reduces time from O(mn) to O(m * 2w).
/// For high-identity alignments the result is identical to a full matrix.
///
/// Returns `None` if the best score is below `min_score`.
pub fn smith_waterman_local(
    query: &[u8],
    target: &[u8],
    params: &ScoringParams,
    band_width: Option<usize>,
    min_score: i32,
) -> Option<AlignmentResult> {
    let n = query.len();  // rows
    let m = target.len(); // columns

    if n == 0 || m == 0 {
        return None;
    }

    // Affine gap model uses three matrices:
    //   H[i][j] = best score ending with a match/mismatch at (i, j)
    //   E[i][j] = best score ending with a gap in the query (target consumed)
    //   F[i][j] = best score ending with a gap in the target (query consumed)
    //
    // For Smith-Waterman, all values are clamped to >= 0.
    //
    // We store the full matrices for traceback.

    let rows = n + 1;
    let cols = m + 1;

    // Allocate flat vectors
    let mut h = vec![0i32; rows * cols];
    let mut e = vec![0i32; rows * cols]; // gap in query (horizontal / target extension)
    let mut f = vec![0i32; rows * cols]; // gap in target (vertical / query extension)
    let mut trace = vec![TraceOp::None; rows * cols];

    // Helper for flat indexing
    let idx = |i: usize, j: usize| -> usize { i * cols + j };

    // Initialize E and F to a very negative value so they don't dominate
    // the first row/column. We use i32::MIN / 2 to avoid overflow on addition.
    let neg_inf = i32::MIN / 2;
    for i in 0..rows {
        for j in 0..cols {
            e[idx(i, j)] = neg_inf;
            f[idx(i, j)] = neg_inf;
        }
    }

    let mut max_score = 0i32;
    let mut max_i = 0usize;
    let mut max_j = 0usize;

    for i in 1..rows {
        // Determine column range for banding
        let (j_start, j_end) = match band_width {
            Some(w) => {
                let center = if m >= n {
                    // target longer: diagonal shifts right
                    (i as isize * m as isize) / n as isize
                } else {
                    i as isize
                };
                let lo = (center - w as isize).max(1) as usize;
                let hi = (center + w as isize + 1).min(cols as isize) as usize;
                (lo, hi)
            }
            None => (1, cols),
        };

        for j in j_start..j_end {
            let q_base = query[i - 1];
            let t_base = target[j - 1];

            let match_mismatch = if q_base.to_ascii_uppercase() == t_base.to_ascii_uppercase() {
                params.match_score
            } else {
                params.mismatch_score
            };

            // E: gap in query (extends along target, horizontal move)
            let e_open = h[idx(i, j - 1)] + params.gap_open + params.gap_extend;
            let e_ext = e[idx(i, j - 1)] + params.gap_extend;
            e[idx(i, j)] = e_open.max(e_ext).max(0);

            // F: gap in target (extends along query, vertical move)
            let f_open = h[idx(i - 1, j)] + params.gap_open + params.gap_extend;
            let f_ext = f[idx(i - 1, j)] + params.gap_extend;
            f[idx(i, j)] = f_open.max(f_ext).max(0);

            // H: best of match/mismatch, E, F, or 0
            let diag = h[idx(i - 1, j - 1)] + match_mismatch;
            let h_val = diag.max(e[idx(i, j)]).max(f[idx(i, j)]).max(0);
            h[idx(i, j)] = h_val;

            // Record traceback direction
            if h_val == 0 {
                trace[idx(i, j)] = TraceOp::None;
            } else if h_val == diag {
                trace[idx(i, j)] = TraceOp::Match;
            } else if h_val == f[idx(i, j)] {
                trace[idx(i, j)] = TraceOp::GapInTarget;
            } else {
                trace[idx(i, j)] = TraceOp::GapInQuery;
            }

            if h_val > max_score {
                max_score = h_val;
                max_i = i;
                max_j = j;
            }
        }
    }

    if max_score < min_score {
        return None;
    }

    // Traceback from (max_i, max_j) until we reach a cell with H == 0
    let mut matches = 0usize;
    let mut mismatches = 0usize;
    let mut gaps = 0usize;

    let mut ci = max_i;
    let mut cj = max_j;

    while ci > 0 && cj > 0 && h[idx(ci, cj)] > 0 {
        match trace[idx(ci, cj)] {
            TraceOp::Match => {
                let q_base = query[ci - 1];
                let t_base = target[cj - 1];
                if q_base.to_ascii_uppercase() == t_base.to_ascii_uppercase() {
                    matches += 1;
                } else {
                    mismatches += 1;
                }
                ci -= 1;
                cj -= 1;
            }
            TraceOp::GapInTarget => {
                // consuming query, gap in target
                gaps += 1;
                ci -= 1;
            }
            TraceOp::GapInQuery => {
                // consuming target, gap in query
                gaps += 1;
                cj -= 1;
            }
            TraceOp::None => break,
        }
    }

    let alignment_length = matches + mismatches + gaps;

    Some(AlignmentResult {
        score: max_score,
        query_start: ci,
        query_end: max_i,
        target_start: cj,
        target_end: max_j,
        matches,
        mismatches,
        gaps,
        alignment_length,
    })
}

/// Run Smith-Waterman on both strands of the target.
///
/// Returns the better alignment together with a boolean indicating whether
/// the reverse complement strand produced the better hit (`true` = reverse
/// complement was better).
///
/// Returns `None` if neither strand produces a score at or above `min_score`.
pub fn align_both_strands(
    query: &[u8],
    target: &[u8],
    params: &ScoringParams,
    band_width: Option<usize>,
    min_score: i32,
) -> Option<(AlignmentResult, bool)> {
    let fwd = smith_waterman_local(query, target, params, band_width, min_score);

    // Build reverse complement of target
    let target_str: String = target.iter().map(|&b| b as char).collect();
    let rc_str = reverse_complement(&target_str);
    let rc_bytes: Vec<u8> = rc_str.bytes().collect();

    let rev = smith_waterman_local(query, &rc_bytes, params, band_width, min_score);

    match (fwd, rev) {
        (Some(f), Some(r)) => {
            if r.score > f.score {
                Some((r, true))
            } else {
                Some((f, false))
            }
        }
        (Some(f), None) => Some((f, false)),
        (None, Some(r)) => Some((r, true)),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    fn default_params() -> ScoringParams {
        ScoringParams::default()
    }

    // -----------------------------------------------------------------
    // 1. Exact match (identical sequences)
    // -----------------------------------------------------------------

    #[test]
    fn test_exact_match() {
        let seq = b"ACGTACGTACGT";
        let params = default_params();
        let result = smith_waterman_local(seq, seq, &params, None, 0).unwrap();

        assert_eq!(result.score, seq.len() as i32 * params.match_score);
        assert_eq!(result.matches, seq.len());
        assert_eq!(result.mismatches, 0);
        assert_eq!(result.gaps, 0);
        assert_eq!(result.query_start, 0);
        assert_eq!(result.query_end, seq.len());
        assert_eq!(result.target_start, 0);
        assert_eq!(result.target_end, seq.len());
        assert!((result.percent_identity() - 100.0).abs() < f64::EPSILON);
        assert!((result.query_coverage(seq.len()) - 100.0).abs() < f64::EPSILON);
    }

    // -----------------------------------------------------------------
    // 2. Partial match with mismatches
    // -----------------------------------------------------------------

    #[test]
    fn test_partial_match_with_mismatches() {
        let query  = b"ACGTACGT";
        let target = b"ACGTXXGT"; // positions 4,5 are mismatches
        let params = default_params();

        let result = smith_waterman_local(query, target, &params, None, 0).unwrap();

        // Local alignment finds the best-scoring region, which may be a
        // shorter exact match rather than the full length with mismatches.
        // With match=2, mismatch=-3: "ACGT" (score 8) beats
        // "ACGTXXGT" (6*2 + 2*(-3) = 6).
        assert!(result.matches > 0);
        assert!(result.score > 0);
    }

    // -----------------------------------------------------------------
    // 3. Match with gaps (insertions / deletions)
    // -----------------------------------------------------------------

    #[test]
    fn test_match_with_insertion() {
        // Target has an extra base inserted in the middle
        let query  = b"ACGTACGT";
        let target = b"ACGTAACGT"; // extra A inserted after position 4
        let params = default_params();

        let result = smith_waterman_local(query, target, &params, None, 0).unwrap();
        assert!(result.score > 0);
        assert!(result.matches > 0);
    }

    #[test]
    fn test_match_with_deletion() {
        // Target has a base deleted
        let query  = b"ACGTACGT";
        let target = b"ACGACGT"; // T at position 3 deleted
        let params = default_params();

        let result = smith_waterman_local(query, target, &params, None, 0).unwrap();
        assert!(result.score > 0);
        assert!(result.matches > 0);
    }

    // -----------------------------------------------------------------
    // 4. No match (unrelated sequences)
    // -----------------------------------------------------------------

    #[test]
    fn test_no_match_unrelated_sequences() {
        let query  = b"AAAAAAAAAA";
        let target = b"CCCCCCCCCC";
        let params = default_params();

        // With mismatch = -3, every position is a penalty, so the local
        // alignment should score 0 (all cells clamp to 0).
        let result = smith_waterman_local(query, target, &params, None, 1);
        assert!(result.is_none());
    }

    // -----------------------------------------------------------------
    // 5. Both-strand detection
    // -----------------------------------------------------------------

    #[test]
    fn test_both_strand_reverse_complement_hit() {
        // Use a non-palindromic query to make this meaningful.
        let query2 = b"AAACCCGGG";
        // RC of AAACCCGGG = CCCGGGTTT
        let target = b"TTTTTTCCCGGGTTTTTTTTT";
        let params = default_params();

        let result = align_both_strands(query2, target, &params, None, 1);
        assert!(result.is_some());
        let (aln, is_rc) = result.unwrap();
        assert!(is_rc, "Expected the reverse complement strand to win");
        assert_eq!(aln.matches, query2.len());
    }

    #[test]
    fn test_both_strand_forward_hit() {
        let query  = b"AAACCCGGG";
        let target = b"TTTTTTAAACCCGGGTTTTTT";
        let params = default_params();

        let result = align_both_strands(query, target, &params, None, 1);
        assert!(result.is_some());
        let (aln, is_rc) = result.unwrap();
        assert!(!is_rc, "Expected the forward strand to win");
        assert_eq!(aln.matches, query.len());
    }

    // -----------------------------------------------------------------
    // 6. Short query against long target
    // -----------------------------------------------------------------

    #[test]
    fn test_short_query_long_target() {
        let query  = b"GATTACA";
        let target = b"AAAAAAAAAAAAGATTACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        let params = default_params();

        let result = smith_waterman_local(query, target, &params, None, 1).unwrap();
        assert_eq!(result.matches, query.len());
        assert_eq!(result.mismatches, 0);
        assert_eq!(result.gaps, 0);
        assert_eq!(result.target_start, 12);
        assert_eq!(result.target_end, 19);
        assert!((result.query_coverage(query.len()) - 100.0).abs() < f64::EPSILON);
    }

    // -----------------------------------------------------------------
    // 7. Banded vs unbanded should agree for high-identity alignments
    // -----------------------------------------------------------------

    #[test]
    fn test_banded_vs_unbanded_identical() {
        let query  = b"ACGTACGTACGTACGTACGT";
        let target = b"ACGTACGTACGTACGTACGT";
        let params = default_params();

        let unbanded = smith_waterman_local(query, target, &params, None, 0).unwrap();
        let banded   = smith_waterman_local(query, target, &params, Some(5), 0).unwrap();

        assert_eq!(unbanded.score, banded.score);
        assert_eq!(unbanded.matches, banded.matches);
        assert_eq!(unbanded.mismatches, banded.mismatches);
        assert_eq!(unbanded.gaps, banded.gaps);
    }

    #[test]
    fn test_banded_vs_unbanded_high_identity() {
        // One mismatch near the centre -- band of 5 is more than enough.
        let query  = b"ACGTACGTACGTACGTACGT";
        let target = b"ACGTACGTAXGTACGTACGT"; // position 9: C -> X
        let params = default_params();

        let unbanded = smith_waterman_local(query, target, &params, None, 0).unwrap();
        let banded   = smith_waterman_local(query, target, &params, Some(5), 0).unwrap();

        assert_eq!(unbanded.score, banded.score);
        assert_eq!(unbanded.matches, banded.matches);
        assert_eq!(unbanded.mismatches, banded.mismatches);
    }

    #[test]
    fn test_banded_vs_unbanded_with_gap() {
        // Single-base insertion: band of 5 should still capture this.
        let query  = b"ACGTACGTACGT";
        let target = b"ACGTAACGTACGT"; // extra A inserted
        let params = default_params();

        let unbanded = smith_waterman_local(query, target, &params, None, 0).unwrap();
        let banded   = smith_waterman_local(query, target, &params, Some(5), 0).unwrap();

        assert_eq!(unbanded.score, banded.score);
    }

    // -----------------------------------------------------------------
    // Additional edge case tests
    // -----------------------------------------------------------------

    #[test]
    fn test_empty_query() {
        let result = smith_waterman_local(b"", b"ACGT", &default_params(), None, 0);
        assert!(result.is_none());
    }

    #[test]
    fn test_empty_target() {
        let result = smith_waterman_local(b"ACGT", b"", &default_params(), None, 0);
        assert!(result.is_none());
    }

    #[test]
    fn test_single_base_match() {
        let result = smith_waterman_local(b"A", b"A", &default_params(), None, 0).unwrap();
        assert_eq!(result.score, 2);
        assert_eq!(result.matches, 1);
    }

    #[test]
    fn test_case_insensitive() {
        let query  = b"acgt";
        let target = b"ACGT";
        let params = default_params();
        let result = smith_waterman_local(query, target, &params, None, 0).unwrap();
        assert_eq!(result.matches, 4);
        assert_eq!(result.mismatches, 0);
    }

    #[test]
    fn test_alignment_result_methods() {
        let aln = AlignmentResult {
            score: 10,
            target_start: 5,
            target_end: 15,
            query_start: 0,
            query_end: 10,
            matches: 8,
            mismatches: 1,
            gaps: 1,
            alignment_length: 10,
        };
        assert!((aln.percent_identity() - 80.0).abs() < f64::EPSILON);
        assert!((aln.query_coverage(20) - 50.0).abs() < f64::EPSILON);
        assert!((aln.query_coverage(10) - 100.0).abs() < f64::EPSILON);
        assert!((aln.query_coverage(0) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_zero_length_alignment_result() {
        let aln = AlignmentResult {
            score: 0,
            target_start: 0,
            target_end: 0,
            query_start: 0,
            query_end: 0,
            matches: 0,
            mismatches: 0,
            gaps: 0,
            alignment_length: 0,
        };
        assert!((aln.percent_identity() - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_min_score_filter() {
        let query  = b"ACGT";
        let target = b"ACGT";
        let params = default_params();

        // Score should be 4*2 = 8
        let result_pass = smith_waterman_local(query, target, &params, None, 8);
        assert!(result_pass.is_some());

        let result_fail = smith_waterman_local(query, target, &params, None, 9);
        assert!(result_fail.is_none());
    }
}
