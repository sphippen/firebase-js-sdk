import { fatal } from "../core/util/util";
import { parseRepoInfo } from "../core/util/libs/parser";
import { Path } from "../core/util/Path";
import { PromiseImpl } from "../../utils/promise";
import { Reference } from "./Reference";
import { Repo } from "../core/Repo";
import { RepoManager } from "../core/RepoManager";
import { validateArgCount } from "../../utils/validation";
import { FirebaseApp } from "../../app/firebase_app";
import { validateUrl } from "../core/util/validation";

/**
 * Class representing a firebase database.
 * @implements {firebase.Service}
 */
export class Database {
  repo_: Repo;
  root_: Reference;
  INTERNAL;
  private __database: Database;

  static ServerValue = {
    'TIMESTAMP': {
      '.sv' : 'timestamp'
    }
  }

  /**
   * The constructor should not be called by users of our public API.
   * @param {!Repo} repo
   */
  constructor(repo) {
    if (!(repo instanceof Repo)) {
      fatal("Don't call new Database() directly - please use firebase.database().");
    }

    /** @type {Repo} */
    this.repo_ = repo;

    /** @type {Firebase} */
    this.root_ = new Reference(repo, Path.Empty);

    this.INTERNAL = new DatabaseInternals(this);
  }

  get app(): FirebaseApp {
    return this.repo_.app;
  }

  get database(): Database {
    return this.__database || (this.__database = new Database(this));
  }

  /**
   * Returns a reference to the root or the path specified in opt_pathString.
   * @param {string=} pathString
   * @return {!Firebase} Firebase reference.
   */
  ref(pathString?): Reference {
    this.checkDeleted_('ref');
    validateArgCount('database.ref', 0, 1, arguments.length);

    return pathString !== undefined ? this.root_.child(pathString) : this.root_;
  }

  /**
   * Returns a reference to the root or the path specified in url.
   * We throw a exception if the url is not in the same domain as the
   * current repo.
   * @param {string} url
   * @return {!Firebase} Firebase reference.
   */
  refFromURL(url) {
    /** @const {string} */
    var apiName = 'database.refFromURL';
    this.checkDeleted_(apiName);
    validateArgCount(apiName, 1, 1, arguments.length);
    var parsedURL = parseRepoInfo(url);
    validateUrl(apiName, 1, parsedURL);

    var repoInfo = parsedURL.repoInfo;
    if (repoInfo.host !== this.repo_.repoInfo_.host) {
      fatal(apiName + ": Host name does not match the current database: " +
                         "(found " + repoInfo.host + " but expected " + this.repo_.repoInfo_.host + ")");
    }

    return this.ref(parsedURL.path.toString());
  }

  /**
   * @param {string} apiName
   */
  private checkDeleted_(apiName) {
    if (this.repo_ === null) {
      fatal("Cannot call " + apiName + " on a deleted database.");
    }
  }

  // Make individual repo go offline.
  goOffline() {
    validateArgCount('database.goOffline', 0, 0, arguments.length);
    this.checkDeleted_('goOffline');
    this.repo_.interrupt();
  }

  goOnline () {
    validateArgCount('database.goOnline', 0, 0, arguments.length);
    this.checkDeleted_('goOnline');
    this.repo_.resume();
  }
};

class DatabaseInternals {
  database
  /** @param {!Database} database */
  constructor(database) {
    this.database = database;
  }

  /** @return {firebase.Promise<void>} */
  delete() {
    this.database.checkDeleted_('delete');
    RepoManager.getInstance().deleteRepo(/** @type {!Repo} */ (this.database.repo_));

    this.database.repo_ = null;
    this.database.root_ = null;
    this.database.INTERNAL = null;
    this.database = null;
    return PromiseImpl.resolve();
  }
};

