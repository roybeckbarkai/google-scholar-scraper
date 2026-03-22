import numpy as np
import matplotlib.pyplot as plt
from scipy import ndimage, fft
import ipywidgets as widgets
from IPython.display import display, clear_output

# ---------------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------------
def draw_rod(img, orient_map, cx, cy, theta, length, radius):
    """Draw a solid rod and record its orientation per pixel."""
    half = length / 2.0
    num = int(length * 2) + 1
    s = np.linspace(-half, half, num)
    xs = cx + s * np.cos(theta)
    ys = cy + s * np.sin(theta)
    for x, y in zip(xs, ys):
        ix = int(round(x)) % img.shape[1]
        iy = int(round(y)) % img.shape[0]
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if dx * dx + dy * dy <= radius * radius:
                    img[(iy + dy) % img.shape[0], (ix + dx) % img.shape[1]] = 1.0
                    orient_map[(iy + dy) % img.shape[0], (ix + dx) % img.shape[1]] = theta


def simulate_rods(N, num_rods, R_pix, L_pix, director_deg, delta_deg, spacing_pix, seed=0):
    """Return density image and per-pixel orientation map (NaN for background)."""
    rng = np.random.default_rng(seed)
    rho = np.zeros((N, N), dtype=float)
    orient_map = np.full((N, N), np.nan)

    # Place rods approximately on a lattice so ⟨spacing⟩ ≈ spacing_pix
    grid_n = int(np.sqrt(num_rods))
    xs = np.linspace(0, N, grid_n, endpoint=False)
    ys = np.linspace(0, N, grid_n, endpoint=False)
    coords = [(x + rng.uniform(-spacing_pix / 3, spacing_pix / 3),
               y + rng.uniform(-spacing_pix / 3, spacing_pix / 3))
              for x in xs for y in ys]
    rng.shuffle(coords)
    coords = coords[:num_rods]

    for cx, cy in coords:
        theta = np.deg2rad(director_deg + rng.normal(0, delta_deg))
        draw_rod(rho, orient_map, cx, cy, theta, L_pix, R_pix)

    return rho, orient_map


def saxs_analysis(rho):
    """FFT-based SAXS, radial I(q) and azimuthal I(χ) (folded 0–180°)."""
    N = rho.shape[0]
    ft = fft.fftshift(fft.fft2(rho))
    I2d = np.abs(ft) ** 2
    I2d /= I2d.max()

    # reciprocal grid
    kx = fft.fftshift(fft.fftfreq(N, d=1.0)) * 2 * np.pi
    ky = kx
    KX, KY = np.meshgrid(kx, ky, indexing='ij')
    K = np.sqrt(KX ** 2 + KY ** 2)
    chi_full = np.rad2deg(np.arctan2(KY, KX))  # −180°..180°

    # radial profile
    n_bins = N // 2
    radial_bins = np.linspace(0, K.max(), n_bins + 1)
    bin_idx = np.digitize(K.ravel(), radial_bins) - 1
    radial_I = ndimage.mean(I2d.ravel(), labels=bin_idx, index=np.arange(n_bins))
    q_centers = 0.5 * (radial_bins[:-1] + radial_bins[1:])

    # locate broad correlation peak (>q=0)
    peak_idx = np.argmax(radial_I[5:]) + 5
    q_peak = q_centers[peak_idx]
    dq = (radial_bins[1] - radial_bins[0]) * 1.5
    mask = (K > q_peak - dq) & (K < q_peak + dq)

    # fold ±χ into 0–180° for mirror symmetry
    chi_fold = np.abs(chi_full[mask])
    chi_bins = np.linspace(0, 180, 181)
    az_I, _ = np.histogram(chi_fold, bins=chi_bins, weights=I2d[mask])
    chi_centers = 0.5 * (chi_bins[:-1] + chi_bins[1:])
    az_I /= az_I.max() + 1e-12

    return I2d, radial_I, q_centers, chi_centers, az_I, q_peak


def cpm_from_image(orient_map, phi_scan_deg):
    """Cross-polar intensity by pixel-wise Malus law."""
    mask = ~np.isnan(orient_map)
    theta_px = orient_map[mask]
    I = []
    for phi in np.deg2rad(phi_scan_deg):
        I.append(np.mean(np.sin(2 * (theta_px - phi)) ** 2))
    I = np.array(I)
    I /= I.max() + 1e-12
    return I


# ---------------------------------------------------------------------------------
# Interactive dashboard
# ---------------------------------------------------------------------------------
style = dict(description_width='140px')

ui = widgets.interactive(
    lambda N, num_rods, R_pix, L_pix,
           director_deg, delta_deg, spacing_pix: run_sim(N, num_rods, R_pix, L_pix,
                                                         director_deg, delta_deg, spacing_pix),
    N=widgets.IntSlider(1024, 512, 2048*32, 256, description='Grid N', style=style),
    num_rods=widgets.IntSlider(1000, 200, 3000, 100, description='Number of rods', style=style),
    R_pix=widgets.IntSlider(3, 1, 6, 1, description='Rod radius (px)', style=style),
    L_pix=widgets.IntSlider(64, 16, 128, 8, description='Rod length (px)', style=style),
    director_deg=widgets.IntSlider(15, 0, 179, 1, description='Director angle (°)', style=style),
    delta_deg=widgets.IntSlider(10, 0, 30, 1, description='Δα std-dev (°)', style=style),
    spacing_pix=widgets.IntSlider(32, 8, 80, 4, description='Avg spacing (px)', style=style)
)


def run_sim(N, num_rods, R_pix, L_pix, director_deg, delta_deg, spacing_pix):
    clear_output(wait=True)

    # --- Step 1: real-space ---
    rho, orient_map = simulate_rods(N, num_rods, R_pix, L_pix,
                                    director_deg, delta_deg, spacing_pix)

    plt.figure(figsize=(5, 5))
    plt.imshow(rho, cmap='gray', origin='lower')
    # double-headed director arrow
    L_arrow = N * 0.25
    dx = L_arrow * np.cos(np.deg2rad(director_deg))
    dy = L_arrow * np.sin(np.deg2rad(director_deg))
    cx, cy = N / 2, N / 2
    plt.arrow(cx - dx / 2, cy - dy / 2, dx, dy,
              width=3, head_width=20, color='orange', length_includes_head=True)
    plt.arrow(cx + dx / 2, cy + dy / 2, -dx, -dy,
              width=3, head_width=20, color='orange', length_includes_head=True)
    plt.text(cx + dx / 2 + 30 * np.sign(dx),
             cy + dy / 2 + 30 * np.sign(dy),
             f'α = {director_deg}°', color='orange', weight='bold')
    plt.title("Step 1: Real-space rods")
    plt.axis('off')
    plt.show()

    # --- Step 2: SAXS from FFT ---
    I2d, radial_I, q_centers, chi_centers, az_I, q_peak = saxs_analysis(rho)

    plt.figure(figsize=(5, 4))
    plt.imshow(np.log10(I2d + 1e-6), origin='lower', cmap='viridis')
    plt.title("Step 2: 2-D SAXS (log10 I)")
    plt.axis('off')
    plt.colorbar()
    plt.show()

    # radial I(q)
    plt.figure()
    plt.plot(q_centers, radial_I, lw=2)
    plt.axvline(q_peak, color='r', ls='--', label=f"q_peak ≈ {q_peak:.2f}")
    plt.xlabel("q (a.u.)")
    plt.ylabel("I(q)")
    plt.title("Radial average")
    plt.legend()
    plt.show()

    # azimuthal I(χ)
    plt.figure()
    plt.plot(chi_centers, az_I, lw=2, color='C1')
    plt.xlabel("χ (deg relative to +x)")
    plt.ylabel("Normalised I(χ)")
    plt.title("Azimuthal intensity at q_peak")
    plt.xlim(0, 180)
    plt.show()

    # --- Step 3: CPM ray simulation ---
    phi_scan = np.linspace(0, 180, 361)
    I_cpm = cpm_from_image(orient_map, phi_scan)

    # --- Step 4: overlay ---
    plt.figure()
    plt.plot(phi_scan, I_cpm, label="CPM (ray from image)", lw=2)
    plt.plot(chi_centers, az_I, label="SAXS (image-derived)", lw=2)
    plt.xlabel("Angle (deg relative to +x)")
    plt.ylabel("Normalised intensity")
    plt.title("Step 4: CPM vs SAXS angular response")
    plt.xlim(0, 180)
    plt.ylim(0, 1.05)
    plt.grid(ls='--', alpha=0.4)
    # mark both director angles (α and α+180)
    plt.axvline(director_deg % 180, color='k', ls=':', lw=1)
    plt.axvline((director_deg + 180) % 180, color='k', ls=':', lw=1)
    plt.text((director_deg % 180) + 2, 1.02, 'α', va='bottom')
    plt.text(((director_deg + 180) % 180) + 2, 1.02, 'α+180°', va='bottom')
    plt.legend()
    plt.show()


print("Move the sliders to regenerate all four steps in real time:")
display(ui)
