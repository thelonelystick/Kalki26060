import numpy as np
import trimesh


def make_island():
    # Base island using a distorted sphere
    lat = np.linspace(-np.pi / 2, np.pi / 2, 120)
    lon = np.linspace(0, 2 * np.pi, 200, endpoint=False)

    verts = []
    faces = []

    for i, theta in enumerate(lat):
        for j, phi in enumerate(lon):
            x = np.cos(theta) * np.cos(phi)
            y = np.sin(theta)
            z = np.cos(theta) * np.sin(phi)

            # Flatten top and sculpt mountainous terrain
            r = 4.3
            terrain = (
                0.85
                + 0.22 * np.sin((x * 7.5) + 0.8)
                + 0.18 * np.cos((z * 8.4) - 1.2)
                + 0.14 * np.sin((y * 11.0) + 2.0)
            )
            x *= r * terrain
            y *= r * (0.52 + 0.25 * np.cos(phi * 2.0))
            z *= r * terrain

            # Make it an island-like flat disk
            if (x ** 2 + z ** 2) > 16.0:
                y *= 0.2

            verts.append([x, y, z])

    for i in range(len(lat) - 1):
        for j in range(len(lon)):
            a = i * len(lon) + j
            b = i * len(lon) + (j + 1) % len(lon)
            c = (i + 1) * len(lon) + j
            d = (i + 1) * len(lon) + (j + 1) % len(lon)

            faces.append([a, c, b])
            faces.append([b, c, d])

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    mesh.vertices -= mesh.vertices.mean(axis=0)
    mesh.apply_translation([0, -0.2, 0])
    return mesh


def make_lake():
    # Simple circular lake
    radius = 1.25
    segments = 80
    theta = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    x = radius * np.cos(theta)
    z = radius * np.sin(theta)

    # Create a low flat cylinder
    top = np.column_stack([x, np.zeros_like(x), z])
    bottom = np.column_stack([x, -0.18 * np.ones_like(x), z])
    vertices = np.vstack([
        [0, 0, 0],
        top,
        [0, -0.18, 0],
        bottom,
    ])
    faces = []
    for i in range(segments):
        j = (i + 1) % segments
        a, b = i + 1, j + 1
        c, d = i + 2 + segments, j + 2 + segments
        faces.append([a, c, b])
        faces.append([b, c, d])
        faces.append([0, b, a])
        faces.append([1 + segments, c, d])

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.apply_translation([0, 0.15, 0])
    return mesh


def make_station():
    # Small station block
    box = trimesh.creation.box(extents=[0.9, 0.7, 0.9])
    box.apply_translation([0.2, 0.75, 0.0])

    roof = trimesh.creation.cone(radius=0.7, height=0.55, sections=4)
    roof.apply_translation([0.2, 1.3, 0.0])
    roof.rotation = trimesh.transformations.rotation_matrix(np.pi / 4, [0, 1, 0])
    return box + roof


def make_peaks():
    group = []
    peaks = [
        (-1.5, 2.1, 1.2, 0.8),
        (1.5, 1.8, -1.0, 0.7),
        (1.0, 2.2, 1.8, 0.9),
        (-1.7, 1.9, -1.3, 0.8),
        (0.4, 2.5, 2.0, 0.7),
    ]
    for x, y, z, r in peaks:
        cone = trimesh.creation.cone(radius=r, height=1.1, sections=6)
        cone.apply_translation([x, y, z])
        cone.rotation = trimesh.transformations.rotation_matrix(np.pi * 0.25, [0, 1, 0])
        group.append(cone)
    return trimesh.util.concatenate(group)


def make_snow_caps():
    caps = []
    for x, y, z, r in [
        (-1.7, 2.3, 1.2, 0.55),
        (1.6, 2.1, -1.0, 0.5),
        (1.0, 2.4, 1.9, 0.68),
        (-1.9, 2.1, -1.4, 0.6),
        (0.5, 2.7, 2.0, 0.5),
    ]:
        cap = trimesh.creation.cone(radius=r, height=0.62, sections=6)
        cap.apply_translation([x, y + 0.45, z])
        cap.visual.face_colors = [200, 210, 220, 255]
        caps.append(cap)
    return trimesh.util.concatenate(caps)


def build_scene():
    island = make_island()
    lake = make_lake()
    station = make_station()
    peaks = make_peaks()
    snow = make_snow_caps()

    # Make all surfaces look snowy/icy
    island.visual.face_colors = [235, 240, 245, 255]
    lake.visual.face_colors = [160, 209, 234, 255]
    station.visual.face_colors = [190, 200, 210, 255]
    peaks.visual.face_colors = [36, 45, 52, 255]
    snow.visual.face_colors = [243, 247, 252, 255]

    scene = trimesh.Scene([
        island,
        lake,
        station,
        peaks,
        snow,
    ])
    return scene


if __name__ == "__main__":
    scene = build_scene()
    scene.export("landscape.glb")
    print("Created landscape.glb")
