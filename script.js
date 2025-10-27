let dbPromise;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("ExamenDB", 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("categorias")) {
                const catStore = db.createObjectStore("categorias", { keyPath: "id", autoIncrement: true });
                catStore.createIndex("nombre", "nombre", { unique: false });
            }
            if (!db.objectStoreNames.contains("productos")) {
                const prodStore = db.createObjectStore("productos", { keyPath: "id", autoIncrement: true });
                prodStore.createIndex("nombre", "nombre", { unique: false });
                prodStore.createIndex("categoriaId", "categoriaId", { unique: false });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function addItem(store, item) {
    return dbPromise.then(db => new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const r = tx.objectStore(store).add(item);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function putItem(store, item) {
    return dbPromise.then(db => new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const r = tx.objectStore(store).put(item);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function deleteItem(store, id) {
    return dbPromise.then(db => new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const r = tx.objectStore(store).delete(id);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    }));
}

function getAll(store) {
    return dbPromise.then(db => new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function getById(store, id) {
    return dbPromise.then(db => new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}


document.addEventListener("DOMContentLoaded", async() => {
    dbPromise = openDB();
    await dbPromise;
    initCategoryForm();
    initProductForm();
    refreshAll();
});


function initCategoryForm() {
    const form = document.getElementById("categoriaForm");
    const nombre = document.getElementById("catNombre");
    const descripcion = document.getElementById("catDescripcion");
    const idInput = document.getElementById("categoriaId");

    form.addEventListener("submit", async(e) => {
        e.preventDefault();
        const item = { nombre: nombre.value.trim(), descripcion: descripcion.value.trim() };
        await addItem("categorias", item);
        form.reset();
        await refreshAll();
        alert("Categoría agregada correctamente.");
    });

    document.getElementById("catActualizar").addEventListener("click", async() => {
        const id = Number(idInput.value);
        const nombreActual = catNombre.value.trim();
        const descripcionNueva = catDescripcion.value.trim();

        if (!nombreActual) return alert("⚠️ Escribe el nombre de la categoría que deseas actualizar.");

        let categoria = null;

        if (!id) {
            const todas = await getAll("categorias");
            categoria = todas.find(c => c.nombre.toLowerCase() === nombreActual.toLowerCase());
        } else {
            categoria = await getById("categorias", id);
        }

        if (!categoria) return alert("❗ No se encontró la categoría para actualizar.");

        categoria.nombre = nombreActual;
        categoria.descripcion = descripcionNueva;

        await putItem("categorias", categoria);
        form.reset();
        await refreshAll();
        alert("✅ Categoría actualizada correctamente.");
    });


    document.getElementById("catBorrar").addEventListener("click", async() => {
        const id = Number(idInput.value);
        const nombre = catNombre.value.trim();


        let categoria = null;
        if (!id && nombre) {
            const todas = await getAll("categorias");
            categoria = todas.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        } else if (id) {
            categoria = await getById("categorias", id);
        }

        if (!categoria) return alert("❗ No se encontró la categoría para borrar.");
        if (!confirm(`¿Borrar la categoría "${categoria.nombre}" y sus productos asociados?`)) return;

        await deleteProductsByCategory(categoria.id);


        await deleteItem("categorias", categoria.id);

        form.reset();
        await refreshAll();
        alert("🗑️ Categoría y productos asociados eliminados correctamente.");
    });

}


function initProductForm() {
    const form = document.getElementById("productoForm");
    const nombre = document.getElementById("prodNombre");
    const precio = document.getElementById("prodPrecio");
    const categoria = document.getElementById("prodCategoria");
    const idInput = document.getElementById("productoId");

    form.addEventListener("submit", async(e) => {
        e.preventDefault();
        const item = {
            nombre: nombre.value.trim(),
            precio: Number(precio.value),
            categoriaId: Number(categoria.value)
        };
        await addItem("productos", item);
        form.reset();
        await refreshAll();
    });

    document.getElementById("prodActualizar").addEventListener("click", async() => {
        const id = Number(idInput.value);
        const nombreActual = document.getElementById("prodNombre").value.trim();
        const nuevoPrecio = Number(document.getElementById("prodPrecio").value);
        const nuevaCategoriaId = Number(document.getElementById("prodCategoria").value);

        if (!nombreActual) return alert("⚠️ Escribe el nombre del producto que deseas actualizar.");

        let producto = null;


        if (!id) {
            const todos = await getAll("productos");
            producto = todos.find(p => p.nombre.toLowerCase() === nombreActual.toLowerCase());
        } else {
            producto = await getById("productos", id);
        }

        if (!producto) return alert("❗ No se encontró el producto para actualizar.");


        producto.nombre = nombreActual;
        producto.precio = nuevoPrecio;
        producto.categoriaId = nuevaCategoriaId || null;

        await putItem("productos", producto);
        document.getElementById("productoForm").reset();
        await refreshAll();
        alert("✅ Producto actualizado correctamente.");
    });


    document.getElementById("prodBorrar").addEventListener("click", async() => {
        const id = Number(idInput.value);
        if (!id) return alert("Selecciona un producto para borrar.");
        if (!confirm("¿Borrar producto?")) return;
        await deleteItem("productos", id);
        form.reset();
        await refreshAll();
    });
}


async function refreshAll() {
    await refreshCategorias();
    await refreshProductos();
}

async function refreshCategorias() {
    const cats = await getAll("categorias");
    const select = document.getElementById("prodCategoria");
    select.innerHTML = `<option value="">-- Selecciona --</option>`;
    cats.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre;
        select.appendChild(opt);
    });
}

async function refreshProductos() {
    const tbody = document.querySelector("#productosTable tbody");
    tbody.innerHTML = "";
    const productos = await getAll("productos");

    for (const p of productos) {
        let catName = "(sin categoría)";
        if (p.categoriaId) {
            const cat = await getById("categorias", p.categoriaId);
            if (cat) catName = cat.nombre;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(String(p.precio))}</td>
            <td>${escapeHtml(catName)}</td>
            <td>
                <button class="btn gray" onclick="actualizarProducto(${p.id})">Actualizar</button>
                <button class="btn red" onclick="confirmDeleteProducto(${p.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}


async function actualizarProducto(id) {
    const producto = await getById("productos", id);
    if (!producto) return alert("❌ Producto no encontrado.");


    const nuevoNombre = document.getElementById("prodNombre").value.trim() || producto.nombre;
    const nuevoPrecio = Number(document.getElementById("prodPrecio").value) || producto.precio;
    const nuevaCategoria = Number(document.getElementById("prodCategoria").value) || producto.categoriaId;

    const actualizado = {
        id: producto.id,
        nombre: nuevoNombre,
        precio: nuevoPrecio,
        categoriaId: nuevaCategoria
    };

    await putItem("productos", actualizado);
    await refreshAll();
    alert("✅ Producto actualizado correctamente.");
}

async function editProducto(id) {
    const p = await getById("productos", id);
    if (!p) return;
    document.getElementById("productoId").value = p.id;
    document.getElementById("prodNombre").value = p.nombre;
    document.getElementById("prodPrecio").value = p.precio;
    document.getElementById("prodCategoria").value = p.categoriaId || "";
}


async function editCategoria(id) {
    const c = await getById("categorias", id);
    if (!c) return;
    document.getElementById("categoriaId").value = c.id;
    document.getElementById("catNombre").value = c.nombre;
    document.getElementById("catDescripcion").value = c.descripcion || "";
}


async function deleteProductsByCategory(catId) {
    const productos = await getAll("productos");
    const relacionados = productos.filter(p => p.categoriaId === catId);
    for (const prod of relacionados) {
        await deleteItem("productos", prod.id);
    }
}


async function confirmDeleteCategoria(id) {
    if (!confirm("¿Borrar categoría? Esto también eliminará los productos relacionados.")) return;

    await deleteProductsByCategory(id);
    await deleteItem("categorias", id);
    await refreshAll();
    alert("🗑️ Categoría y productos relacionados eliminados correctamente.");
}
async function confirmDeleteProducto(id) {
    if (!confirm("¿Borrar producto?")) return;
    await deleteItem("productos", id);
    await refreshAll();
    alert("🗑️ Producto eliminado correctamente.");
}

function escapeHtml(s) {
    if (!s && s !== 0) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

window.editCategoria = editCategoria;
window.confirmDeleteCategoria = confirmDeleteCategoria;
window.editProducto = editProducto;
window.confirmDeleteProducto = confirmDeleteProducto;